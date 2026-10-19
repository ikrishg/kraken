import { domainsReferToSameHost, normalizeDomain } from "@/lib/utils/domain";

export type RemoveCustomDomainOutcome =
  | { status: "invalid" }
  | { status: "forbidden" }
  | { status: "removed"; ownedDomain: string };

export async function removeCustomDomainIfOwned(params: {
  requestedDomain: string;
  storedDomain: string | null | undefined;
  removeFromVercel: (domain: string) => Promise<void>;
}): Promise<RemoveCustomDomainOutcome> {
  const domain = normalizeDomain(params.requestedDomain);

  if (!domain) {
    return { status: "invalid" };
  }

  const storedDomain = params.storedDomain ?? null;

  if (!storedDomain || !domainsReferToSameHost(storedDomain, domain)) {
    return { status: "forbidden" };
  }

  try {
    await params.removeFromVercel(storedDomain);
  } catch {
    // Continue local cleanup even if Vercel API already removed the domain.
  }

  return { status: "removed", ownedDomain: storedDomain };
}

export function callerOwnsStoredDomain(
  storedDomain: string | null | undefined,
  requestedDomain: string,
): boolean {
  const domain = normalizeDomain(requestedDomain);

  if (!domain || !storedDomain) {
    return false;
  }

  return domainsReferToSameHost(storedDomain, domain);
}
