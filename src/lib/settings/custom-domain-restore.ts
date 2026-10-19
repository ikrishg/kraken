export type PublicationDomainSnapshot = {
  vercelHostname: string | null;
  domainKey: string | null;
  verified: boolean;
};

export function canStartDomainClaim(
  currentKey: string | null | undefined,
  currentVerified: boolean,
  targetKey: string,
): boolean {
  if (!currentKey) {
    return true;
  }

  if (currentKey === targetKey) {
    return true;
  }

  return currentVerified;
}

export function shouldRollbackClaim(
  claimedKey: string,
  currentKey: string | null | undefined,
): boolean {
  return currentKey === claimedKey;
}
