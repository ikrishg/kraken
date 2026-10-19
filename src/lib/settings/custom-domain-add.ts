import type { PublicationDomainSnapshot } from "@/lib/settings/custom-domain-restore";
import { canStartDomainClaim } from "@/lib/settings/custom-domain-restore";
import {
  isReservedCustomDomain,
  parseCustomDomainInput,
} from "@/lib/utils/domain";

export type CustomDomainClaim = {
  vercelHostname: string;
  domainKey: string;
};

export type AddCustomDomainOutcome =
  | { status: "invalid" }
  | { status: "reserved" }
  | { status: "in-use" }
  | { status: "change-in-progress" }
  | { status: "add-failed"; rolledBack: boolean }
  | { status: "verified"; claim: CustomDomainClaim }
  | { status: "pending"; claim: CustomDomainClaim };

export async function invalidateDomainCacheKeys(
  invalidateDomainCache: ((domainKey: string) => Promise<void>) | undefined,
  ...domainKeys: (string | null | undefined)[]
): Promise<void> {
  if (!invalidateDomainCache) {
    return;
  }

  const seen = new Set<string>();

  for (const domainKey of domainKeys) {
    if (!domainKey || seen.has(domainKey)) {
      continue;
    }

    seen.add(domainKey);
    await invalidateDomainCache(domainKey);
  }
}

export function shouldRemovePreviousVercelHost(
  claim: CustomDomainClaim,
  previousVercelHostname: string,
  stored: { vercelHostname: string | null; domainKey: string | null },
): boolean {
  if (!stored.vercelHostname || !stored.domainKey) {
    return false;
  }

  if (
    stored.vercelHostname !== claim.vercelHostname ||
    stored.domainKey !== claim.domainKey
  ) {
    return false;
  }

  if (previousVercelHostname === stored.vercelHostname) {
    return false;
  }

  return true;
}

export function shouldBlockAddForConflict(
  domainKey: string,
  currentUserId: string,
  owner: { userId: string; domainKey: string } | null,
): boolean {
  if (!owner) {
    return false;
  }

  if (owner.userId === currentUserId) {
    return false;
  }

  return owner.domainKey === domainKey;
}

export async function executeCustomDomainAdd(params: {
  requestedDomain: string;
  current: PublicationDomainSnapshot;
  conflictOwner: { userId: string; domainKey: string } | null;
  currentUserId: string;
  claimInDatabase: (
    claim: CustomDomainClaim,
  ) => Promise<"claimed" | "in-use" | "blocked">;
  addToVercel: (vercelHostname: string) => Promise<{ verified: boolean }>;
  rollbackClaim: (
    claim: CustomDomainClaim,
    previous: PublicationDomainSnapshot,
  ) => Promise<boolean>;
  removePreviousFromVercel: (vercelHostname: string) => Promise<void>;
  readPublicationDomain: () => Promise<{
    vercelHostname: string | null;
    domainKey: string | null;
  } | null>;
  invalidateDomainCache?: (domainKey: string) => Promise<void>;
  logWarning?: (message: string) => void;
}): Promise<AddCustomDomainOutcome> {
  const parsed = parseCustomDomainInput(params.requestedDomain);

  if (!parsed) {
    return { status: "invalid" };
  }

  const claim: CustomDomainClaim = {
    vercelHostname: parsed.vercelHostname,
    domainKey: parsed.domainKey,
  };

  if (isReservedCustomDomain(params.requestedDomain)) {
    return { status: "reserved" };
  }

  if (
    shouldBlockAddForConflict(
      claim.domainKey,
      params.currentUserId,
      params.conflictOwner,
    )
  ) {
    return { status: "in-use" };
  }

  if (
    !canStartDomainClaim(
      params.current.domainKey,
      params.current.verified,
      claim.domainKey,
    )
  ) {
    return { status: "change-in-progress" };
  }

  const previous = params.current;
  const claimResult = await params.claimInDatabase(claim);

  if (claimResult === "in-use") {
    return { status: "in-use" };
  }

  if (claimResult === "blocked") {
    return { status: "change-in-progress" };
  }

  await invalidateDomainCacheKeys(
    params.invalidateDomainCache,
    previous.domainKey,
    claim.domainKey,
  );

  try {
    const result = await params.addToVercel(claim.vercelHostname);

    if (
      previous.vercelHostname &&
      previous.vercelHostname !== claim.vercelHostname
    ) {
      try {
        const stored = await params.readPublicationDomain();

        if (
          stored &&
          shouldRemovePreviousVercelHost(claim, previous.vercelHostname, stored)
        ) {
          try {
            await params.removePreviousFromVercel(previous.vercelHostname);
          } catch (error) {
            const detail =
              error instanceof Error ? error.message : "unknown Vercel error";
            params.logWarning?.(
              `Best-effort removal of previous Vercel domain ${previous.vercelHostname} failed: ${detail}`,
            );
          }
        }
      } catch (error) {
        const detail =
          error instanceof Error ? error.message : "unknown database error";
        params.logWarning?.(
          `Skipped previous Vercel domain cleanup because publication state could not be read: ${detail}`,
        );
      }
    }

    await invalidateDomainCacheKeys(
      params.invalidateDomainCache,
      previous.domainKey,
      claim.domainKey,
    );

    return result.verified
      ? { status: "verified", claim }
      : { status: "pending", claim };
  } catch {
    const rolledBack = await params.rollbackClaim(claim, previous);

    if (rolledBack) {
      await invalidateDomainCacheKeys(
        params.invalidateDomainCache,
        previous.domainKey,
        claim.domainKey,
      );
    }

    return { status: "add-failed", rolledBack };
  }
}
