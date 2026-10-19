import { callerOwnsStoredDomain } from "@/lib/settings/custom-domain-security";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";

export function canVerifyStoredDomain(
  storedDomain: string | null | undefined,
  requestedDomain: string,
): boolean {
  return callerOwnsStoredDomain(storedDomain, requestedDomain);
}

export function shouldApplyOwnedDomainMutation(
  storedDomain: string | null | undefined,
  ownedDomain: string,
): boolean {
  if (!storedDomain) {
    return false;
  }

  return (
    normalizeStoredCustomDomain(storedDomain) ===
    normalizeStoredCustomDomain(ownedDomain)
  );
}
