import { domainsReferToSameHost } from "@/lib/utils/domain";

export function canVerifyStoredDomain(
  storedDomainKey: string | null | undefined,
  requestedDomain: string,
): boolean {
  if (!storedDomainKey) {
    return false;
  }

  return domainsReferToSameHost(storedDomainKey, requestedDomain);
}

export function shouldApplyOwnedDomainMutation(
  storedDomainKey: string | null | undefined,
  ownedDomainKey: string,
): boolean {
  if (!storedDomainKey) {
    return false;
  }

  return storedDomainKey === ownedDomainKey;
}
