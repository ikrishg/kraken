"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { forbidden, redirect } from "next/navigation";
import { publications, user } from "@/db/schema";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";
import {
  callerOwnsStoredDomain,
  removeCustomDomainIfOwned,
} from "@/lib/settings/custom-domain-security";
import { normalizeDomain } from "@/lib/utils/domain";
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

function domainLookupValues(domain: string): string[] {
  const normalized = normalizeDomain(domain);

  if (!normalized) {
    return [];
  }

  const bare = normalized.startsWith("www.") ? normalized.slice(4) : normalized;

  return [...new Set([normalized, bare, `www.${bare}`])];
}

async function getUserPublication(userId: string) {
  return db
    .select({
      id: publications.id,
      customDomain: publications.customDomain,
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
  const domain =
    typeof rawDomain === "string" ? normalizeDomain(rawDomain) : "";

  if (!domain) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await ensurePublication(
    session.user.id,
    `${session.user.name || session.user.username} Publication`,
  );

  const lookupValues = domainLookupValues(domain);

  const conflictingOwner = await db
    .select({ id: publications.id })
    .from(publications)
    .where(
      and(
        inArray(publications.customDomain, lookupValues),
        ne(publications.userId, session.user.id),
      ),
    )
    .then((rows) => rows[0]);

  if (conflictingOwner) {
    forbidden();
  }

  try {
    const result = await addProjectDomain(domain);

    await db
      .update(publications)
      .set({
        customDomain: domain,
        customDomainVerified: result.verified,
        updatedAt: new Date(),
      })
      .where(eq(publications.id, publication.id));

    revalidatePath("/settings");
    toSettingsRedirect(
      result.verified ? "domain-added" : "domain-pending-verification",
    );
  } catch (error) {
    const detail = getErrorDetail(error);
    toSettingsRedirect("domain-add-failed", detail);
  }
}

export async function verifyCustomDomain(formData: FormData) {
  const session = await useOnboarded();
  const rawDomain = formData.get("customDomain");
  const domain =
    typeof rawDomain === "string" ? normalizeDomain(rawDomain) : "";

  if (!domain) {
    toSettingsRedirect("invalid-domain");
  }

  const publication = await getUserPublication(session.user.id);

  if (!callerOwnsStoredDomain(publication?.customDomain, domain)) {
    forbidden();
  }

  const ownedDomain = publication?.customDomain;
  if (!ownedDomain) {
    forbidden();
  }

  try {
    const result = await verifyProjectDomain(ownedDomain);

    await db
      .update(publications)
      .set({
        customDomain: ownedDomain,
        customDomainVerified: result.verified,
        updatedAt: new Date(),
      })
      .where(eq(publications.id, publication.id));

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
    typeof rawDomain === "string" ? normalizeDomain(rawDomain) : "";

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
    forbidden();
  }

  if (outcome.status === "invalid" || !publication) {
    toSettingsRedirect("invalid-domain");
  }

  await db
    .update(publications)
    .set({
      customDomain: null,
      customDomainVerified: false,
      updatedAt: new Date(),
    })
    .where(eq(publications.id, publication.id));

  revalidatePath("/settings");
  toSettingsRedirect("domain-removed");
}
