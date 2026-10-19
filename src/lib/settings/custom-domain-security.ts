import {
  domainsReferToSameHost,
  normalizeStoredCustomDomain,
} from "@/lib/utils/domain";
import { isVercelDomainNotFoundOnRemove } from "@/lib/vercel-domains";

export type RemoveCustomDomainOutcome =
  | { status: "invalid" }
  | { status: "forbidden" }
  | { status: "vercel-failed" }
  | { status: "removed"; vercelHostname: string; domainKey: string };

export async function removeCustomDomainIfOwned(params: {
  requestedDomain: string;
  storedVercelHostname: string | null | undefined;
  storedDomainKey: string | null | undefined;
  removeFromVercel: (vercelHostname: string) => Promise<void>;
}): Promise<RemoveCustomDomainOutcome> {
  const domainKey = normalizeStoredCustomDomain(params.requestedDomain);

  if (!domainKey) {
    return { status: "invalid" };
  }

  const storedDomainKey = params.storedDomainKey ?? null;
  const storedVercelHostname = params.storedVercelHostname ?? null;

  if (
    !storedDomainKey ||
    !storedVercelHostname ||
    !domainsReferToSameHost(storedDomainKey, domainKey)
  ) {
    return { status: "forbidden" };
  }

  try {
    await params.removeFromVercel(storedVercelHostname);
  } catch (error) {
    if (!isVercelDomainNotFoundOnRemove(error)) {
      return { status: "vercel-failed" };
    }
  }

  return {
    status: "removed",
    vercelHostname: storedVercelHostname,
    domainKey: storedDomainKey,
  };
}

export function callerOwnsStoredDomain(
  storedDomainKey: string | null | undefined,
  requestedDomain: string,
): boolean {
  const domainKey = normalizeStoredCustomDomain(requestedDomain);

  if (!domainKey || !storedDomainKey) {
    return false;
  }

  return domainsReferToSameHost(storedDomainKey, domainKey);
}
