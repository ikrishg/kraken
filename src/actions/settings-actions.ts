"use server";

import { and, eq, isNull, ne, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect, unstable_rethrow } from "next/navigation";
import { publications, user } from "@/db/schema";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db-errors";
import { executeCustomDomainAdd } from "@/lib/settings/custom-domain-add";
import {
  canStartDomainClaim,
  shouldRollbackClaim,
} from "@/lib/settings/custom-domain-restore";
import { removeCustomDomainIfOwned } from "@/lib/settings/custom-domain-security";
import { canVerifyStoredDomain } from "@/lib/settings/custom-domain-verify";
import { parseCustomDomainInput } from "@/lib/utils/domain";
import {
  addProjectDomain,
  removeProjectDomain,
  verifyProjectDomain,
} from "@/lib/vercel-domains";

function getErrorDetail(error: unknown): string | null {
  if (error instanceof Error) {
    const detail = error.message.trim();
    return detail.length > 0 ? detail.slice(0, 240) : null;
  }

  return null;
}

function toSettingsRedirect(status: string, detail?: string | null): never {
  const params = new URLSearchParams({ status });

  if (detail) {
    params.set("detail", detail);
  }

  redirect(`/settings?${params.toString()}`);
}

async function getUserPublication(userId: string) {
  return db
    .select({
      id: publications.id,
      customDomain: publications.customDomain,
      customDomainKey: publications.customDomainKey,
      customDomainVerified: publications.customDomainVerified,
    })
    .from(publications)
    .where(eq(publications.userId, userId))
    .then((rows) => rows[0]);
}

async function ensurePublication(userId: string, fallbackName: string) {
  const existing = await db
    .select({ id: publications.id })
    .from(publications)
    .where(eq(publications.userId, userId))
    .then((rows) => rows[0]);

  if (existing) {
    return existing;
  }

  const created = await db
    .insert(publications)
    .values({
      userId,
      name: fallbackName,
      updatedAt: new Date(),
    })
    .returning({ id: publications.id })
    .then((rows) => rows[0]);

  return created;
}

async function findConflictingDomainOwner(
  domainKey: string,
  excludeUserId: string,
) {
  return db
    .select({
      id: publications.id,
      userId: publications.userId,
      customDomainKey: publications.customDomainKey,
    })
    .from(publications)
    .where(
      and(
        eq(publications.customDomainKey, domainKey),
        ne(publications.userId, excludeUserId),
      ),
    )
    .then((rows) => rows[0]);
}

export async function updateDisplayName(formData: FormData) {
  const session = await useOnboarded();
  const rawName = formData.get("name");
  const name = typeof rawName === "string" ? rawName.trim() : "";

  if (name.length < 2) {
    toSettingsRedirect("invalid-name");
  }

  await db
    .update(user)
    .set({ name, updatedAt: new Date() })
    .where(eq(user.id, session.user.id));

  revalidatePath("/settings");
  revalidatePath(`/~${session.user.username}`);
  toSettingsRedirect("name-updated");
}

export async function updatePublicationTitle(formData: FormData) {
  const session = await useOnboarded();
  const rawTitle = formData.get("publicationTitle");
  const publicationTitle = typeof rawTitle === "string" ? rawTitle.trim() : "";

  if (publicationTitle.length < 2) {
    toSettingsRedirect("invalid-publication-title");
  }

  const publication = await ensurePublication(
    session.user.id,
    `${session.user.name || session.user.username} Publication`,
  );

  await db
    .update(publications)
    .set({ name: publicationTitle, updatedAt: new Date() })
    .where(eq(publications.id, publication.id));

  revalidatePath("/settings");
  revalidatePath(`/~${session.user.username}`);
  toSettingsRedirect("publication-title-updated");
}

export async function addCustomDomain(formData: FormData) {
  const session = await useOnboarded();
  const rawDomain = formData.get("customDomain");
  const parsed =
    typeof rawDomain === "string" ? parseCustomDomainInput(rawDomain) : null;

  if (!parsed) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await ensurePublication(
    session.user.id,
    `${session.user.name || session.user.username} Publication`,
  );

  const existingPublication = await getUserPublication(session.user.id);
  const current = {
    vercelHostname: existingPublication?.customDomain ?? null,
    domainKey: existingPublication?.customDomainKey ?? null,
    verified: existingPublication?.customDomainVerified ?? false,
  };

  const conflict = await findConflictingDomainOwner(
    parsed.domainKey,
    session.user.id,
  );

  const outcome = await executeCustomDomainAdd({
    requestedDomain: rawDomain as string,
    current,
    currentUserId: session.user.id,
    conflictOwner: conflict
      ? {
          userId: conflict.userId,
          domainKey: conflict.customDomainKey || "",
        }
      : null,
    claimInDatabase: async (claim) => {
      if (
        !canStartDomainClaim(
          current.domainKey,
          current.verified,
          claim.domainKey,
        )
      ) {
        return "blocked";
      }

      try {
        const updated = await db
          .update(publications)
          .set({
            customDomain: claim.vercelHostname,
            customDomainKey: claim.domainKey,
            customDomainVerified: false,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(publications.id, publication.id),
              or(
                isNull(publications.customDomainKey),
                eq(publications.customDomainKey, claim.domainKey),
                eq(publications.customDomainVerified, true),
              ),
            ),
          )
          .returning({ id: publications.id });

        if (updated.length === 0) {
          return "blocked";
        }

        return "claimed";
      } catch (error) {
        if (isUniqueViolation(error)) {
          return "in-use";
        }

        throw error;
      }
    },
    rollbackClaim: async (claim, previous) => {
      const latest = await getUserPublication(session.user.id);

      if (!shouldRollbackClaim(claim.domainKey, latest?.customDomainKey)) {
        return false;
      }

      const updated = await db
        .update(publications)
        .set({
          customDomain: previous.vercelHostname,
          customDomainKey: previous.domainKey,
          customDomainVerified: previous.verified,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(publications.id, publication.id),
            eq(publications.customDomainKey, claim.domainKey),
          ),
        )
        .returning({ id: publications.id });

      return updated.length > 0;
    },
    addToVercel: addProjectDomain,
    removePreviousFromVercel: removeProjectDomain,
    readPublicationDomain: async () => {
      const latest = await getUserPublication(session.user.id);

      if (!latest) {
        return null;
      }

      return {
        vercelHostname: latest.customDomain,
        domainKey: latest.customDomainKey,
      };
    },
    logWarning: (message) => {
      console.warn(message);
    },
  });

  if (outcome.status === "invalid") {
    toSettingsRedirect("invalid-domain");
  }

  if (outcome.status === "reserved") {
    toSettingsRedirect("domain-reserved");
  }

  if (outcome.status === "in-use") {
    toSettingsRedirect("domain-in-use");
  }

  if (outcome.status === "change-in-progress") {
    toSettingsRedirect("domain-change-in-progress");
  }

  if (outcome.status === "add-failed") {
    toSettingsRedirect(
      "domain-add-failed",
      outcome.rolledBack
        ? "Could not add the domain on Vercel. Your publication record was rolled back to the previous saved domain. Your previous Vercel registration was left in place."
        : "Could not add the domain on Vercel, and the pending claim was already replaced by a newer domain change.",
    );
  }

  if (outcome.status === "verified" || outcome.status === "pending") {
    await db
      .update(publications)
      .set({
        customDomainVerified: outcome.status === "verified",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(publications.id, publication.id),
          eq(publications.customDomainKey, outcome.claim.domainKey),
          eq(publications.customDomain, outcome.claim.vercelHostname),
        ),
      );
  }

  revalidatePath("/settings");
  toSettingsRedirect(
    outcome.status === "verified"
      ? "domain-added"
      : "domain-pending-verification",
  );
}

export async function verifyCustomDomain(formData: FormData) {
  const session = await useOnboarded();
  const rawDomain = formData.get("customDomain");
  const parsed =
    typeof rawDomain === "string" ? parseCustomDomainInput(rawDomain) : null;

  if (!parsed) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await getUserPublication(session.user.id);

  if (!canVerifyStoredDomain(publication?.customDomainKey, parsed.domainKey)) {
    toSettingsRedirect("domain-forbidden");
  }

  const ownedVercelHostname = publication?.customDomain;
  const ownedDomainKey = publication?.customDomainKey;

  if (!ownedVercelHostname || !ownedDomainKey) {
    toSettingsRedirect("domain-forbidden");
  }

  let result: Awaited<ReturnType<typeof verifyProjectDomain>>;

  try {
    result = await verifyProjectDomain(ownedVercelHostname);
  } catch (error) {
    unstable_rethrow(error);
    toSettingsRedirect("domain-verify-failed", getErrorDetail(error));
  }

  const updated = await db
    .update(publications)
    .set({
      customDomainVerified: result.verified,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publications.id, publication.id),
        eq(publications.customDomain, ownedVercelHostname),
        eq(publications.customDomainKey, ownedDomainKey),
      ),
    )
    .returning({ id: publications.id });

  if (!publication || updated.length === 0) {
    toSettingsRedirect("domain-forbidden");
  }

  revalidatePath("/settings");
  toSettingsRedirect(
    result.verified ? "domain-verified" : "domain-pending-verification",
  );
}

export async function removeCustomDomain(formData: FormData) {
  const session = await useOnboarded();
  const rawDomain = formData.get("customDomain");
  const parsed =
    typeof rawDomain === "string" ? parseCustomDomainInput(rawDomain) : null;

  if (!parsed) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await getUserPublication(session.user.id);

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: parsed.domainKey,
    storedVercelHostname: publication?.customDomain,
    storedDomainKey: publication?.customDomainKey,
    removeFromVercel: removeProjectDomain,
  });

  if (outcome.status === "forbidden") {
    toSettingsRedirect("domain-forbidden");
  }

  if (outcome.status === "vercel-failed") {
    toSettingsRedirect(
      "domain-remove-failed",
      "Could not remove the domain on Vercel. Your publication still has this domain saved.",
    );
  }

  if (outcome.status === "invalid" || !publication) {
    toSettingsRedirect("invalid-domain");
  }

  const updated = await db
    .update(publications)
    .set({
      customDomain: null,
      customDomainKey: null,
      customDomainVerified: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publications.id, publication.id),
        eq(publications.customDomain, outcome.vercelHostname),
        eq(publications.customDomainKey, outcome.domainKey),
      ),
    )
    .returning({ id: publications.id });

  if (updated.length === 0) {
    toSettingsRedirect("domain-forbidden");
  }

  revalidatePath("/settings");
  toSettingsRedirect("domain-removed");
}
