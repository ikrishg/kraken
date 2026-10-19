"use server";

import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { publications, user } from "@/db/schema";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";
import { isUniqueViolation } from "@/lib/db-errors";
import { executeCustomDomainAdd } from "@/lib/settings/custom-domain-add";
import { removeCustomDomainIfOwned } from "@/lib/settings/custom-domain-security";
import { canVerifyStoredDomain } from "@/lib/settings/custom-domain-verify";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";
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
  bareDomain: string,
  excludeUserId: string,
) {
  return db
    .select({
      id: publications.id,
      userId: publications.userId,
      customDomain: publications.customDomain,
    })
    .from(publications)
    .where(
      and(
        eq(publications.customDomain, bareDomain),
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
  const bareDomain =
    typeof rawDomain === "string" ? normalizeStoredCustomDomain(rawDomain) : "";

  if (!bareDomain) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await ensurePublication(
    session.user.id,
    `${session.user.name || session.user.username} Publication`,
  );

  const existingPublication = await getUserPublication(session.user.id);
  const previousDomain = existingPublication?.customDomain ?? null;
  const previousVerified = existingPublication?.customDomainVerified ?? false;

  const conflict = await findConflictingDomainOwner(
    bareDomain,
    session.user.id,
  );

  const outcome = await executeCustomDomainAdd({
    requestedDomain: rawDomain as string,
    currentDomain: previousDomain,
    currentUserId: session.user.id,
    conflictOwner: conflict
      ? {
          userId: conflict.userId,
          bareDomain: normalizeStoredCustomDomain(conflict.customDomain || ""),
        }
      : null,
    removeFromVercel: removeProjectDomain,
    addToVercel: addProjectDomain,
    claimInDatabase: async (nextDomain) => {
      try {
        await db
          .update(publications)
          .set({
            customDomain: nextDomain,
            customDomainVerified: false,
            updatedAt: new Date(),
          })
          .where(eq(publications.id, publication.id));

        return "claimed";
      } catch (error) {
        if (isUniqueViolation(error)) {
          return "in-use";
        }

        throw error;
      }
    },
    restoreDatabase: async (restoredDomain) => {
      await db
        .update(publications)
        .set({
          customDomain: restoredDomain,
          customDomainVerified: restoredDomain ? previousVerified : false,
          updatedAt: new Date(),
        })
        .where(eq(publications.id, publication.id));
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

  if (outcome.status === "remove-previous-failed") {
    toSettingsRedirect(
      "domain-add-failed",
      "Could not remove your previous domain from Vercel. Nothing was changed.",
    );
  }

  if (outcome.status === "add-failed") {
    toSettingsRedirect(
      "domain-add-failed",
      "Could not add the domain on Vercel. Your previous domain was restored.",
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
          eq(publications.customDomain, outcome.bareDomain),
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
  const domain =
    typeof rawDomain === "string" ? normalizeStoredCustomDomain(rawDomain) : "";

  if (!domain) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await getUserPublication(session.user.id);

  if (!canVerifyStoredDomain(publication?.customDomain, domain)) {
    toSettingsRedirect("domain-forbidden");
  }

  const ownedDomain = publication?.customDomain;
  if (!ownedDomain) {
    toSettingsRedirect("domain-forbidden");
  }

  try {
    const result = await verifyProjectDomain(ownedDomain);

    const updated = await db
      .update(publications)
      .set({
        customDomain: ownedDomain,
        customDomainVerified: result.verified,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(publications.id, publication.id),
          eq(publications.customDomain, ownedDomain),
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
  } catch (error) {
    const detail = getErrorDetail(error);
    toSettingsRedirect("domain-verify-failed", detail);
  }
}

export async function removeCustomDomain(formData: FormData) {
  const session = await useOnboarded();
  const rawDomain = formData.get("customDomain");
  const domain =
    typeof rawDomain === "string" ? normalizeStoredCustomDomain(rawDomain) : "";

  if (!domain) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await getUserPublication(session.user.id);

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: domain,
    storedDomain: publication?.customDomain,
    removeFromVercel: removeProjectDomain,
  });

  if (outcome.status === "forbidden") {
    toSettingsRedirect("domain-forbidden");
  }

  if (outcome.status === "invalid" || !publication) {
    toSettingsRedirect("invalid-domain");
  }

  const ownedDomain = outcome.ownedDomain;

  const updated = await db
    .update(publications)
    .set({
      customDomain: null,
      customDomainVerified: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(publications.id, publication.id),
        eq(publications.customDomain, ownedDomain),
      ),
    )
    .returning({ id: publications.id });

  if (updated.length === 0) {
    toSettingsRedirect("domain-forbidden");
  }

  revalidatePath("/settings");
  toSettingsRedirect("domain-removed");
}
