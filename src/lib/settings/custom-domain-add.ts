import {
  isReservedCustomDomain,
  normalizeStoredCustomDomain,
} from "@/lib/utils/domain";

export type AddCustomDomainOutcome =
  | { status: "invalid" }
  | { status: "reserved" }
  | { status: "in-use" }
  | { status: "remove-previous-failed" }
  | { status: "claim-failed" }
  | { status: "add-failed" }
  | { status: "verified"; bareDomain: string }
  | { status: "pending"; bareDomain: string };

export function shouldBlockAddForConflict(
  bareDomain: string,
  currentUserId: string,
  owner: { userId: string; bareDomain: string } | null,
): boolean {
  if (!owner) {
    return false;
  }

  if (owner.userId === currentUserId) {
    return false;
  }

  return owner.bareDomain === bareDomain;
}

export async function executeCustomDomainAdd(params: {
  requestedDomain: string;
  currentDomain: string | null;
  conflictOwner: { userId: string; bareDomain: string } | null;
  currentUserId: string;
  removeFromVercel: (domain: string) => Promise<void>;
  addToVercel: (domain: string) => Promise<{ verified: boolean }>;
  claimInDatabase: (bareDomain: string) => Promise<"claimed" | "in-use">;
  restoreDatabase: (previousDomain: string | null) => Promise<void>;
}): Promise<AddCustomDomainOutcome> {
  const bareDomain = normalizeStoredCustomDomain(params.requestedDomain);

  if (!bareDomain) {
    return { status: "invalid" };
  }

  if (isReservedCustomDomain(bareDomain)) {
    return { status: "reserved" };
  }

  if (
    shouldBlockAddForConflict(
      bareDomain,
      params.currentUserId,
      params.conflictOwner,
    )
  ) {
    return { status: "in-use" };
  }

  const previousDomain = params.currentDomain
    ? normalizeStoredCustomDomain(params.currentDomain)
    : null;

  if (previousDomain && previousDomain !== bareDomain) {
    try {
      await params.removeFromVercel(previousDomain);
    } catch {
      return { status: "remove-previous-failed" };
    }
  }

  const claimResult = await params.claimInDatabase(bareDomain);

  if (claimResult === "in-use") {
    return { status: "in-use" };
  }

  try {
    const result = await params.addToVercel(bareDomain);

    return result.verified
      ? { status: "verified", bareDomain }
      : { status: "pending", bareDomain };
  } catch {
    await params.restoreDatabase(previousDomain);
    return { status: "add-failed" };
  }
}
