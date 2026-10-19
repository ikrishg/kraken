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

  try {
    const result = await params.addToVercel(claim.vercelHostname);

    if (
      previous.vercelHostname &&
      previous.vercelHostname !== claim.vercelHostname
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

    return result.verified
      ? { status: "verified", claim }
      : { status: "pending", claim };
  } catch {
    const rolledBack = await params.rollbackClaim(claim, previous);
    return { status: "add-failed", rolledBack };
  }
}
