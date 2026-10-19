function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

export function normalizeDomain(raw: string): string {
  const candidate = raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "");
  const hostname = candidate.split("/")[0]?.replace(/\.$/, "") ?? "";

  if (
    !hostname ||
    hostname.startsWith(".") ||
    hostname.includes("..") ||
    hostname.includes(":") ||
    !hostname.includes(".") ||
    !/^[a-z0-9.-]+$/.test(hostname)
  ) {
    return "";
  }

  return hostname;
}

export function normalizeVercelCustomDomain(raw: string): string {
  return normalizeDomain(raw);
}

export function normalizeStoredCustomDomain(raw: string): string {
  const normalized = normalizeDomain(raw);

  if (!normalized) {
    return "";
  }

  return stripWww(normalized);
}

export function parseCustomDomainInput(raw: string): {
  vercelHostname: string;
  domainKey: string;
} | null {
  const vercelHostname = normalizeVercelCustomDomain(raw);
  const domainKey = normalizeStoredCustomDomain(raw);

  if (!vercelHostname || !domainKey) {
    return null;
  }

  return { vercelHostname, domainKey };
}

export function domainsReferToSameHost(a: string, b: string): boolean {
  const left = normalizeStoredCustomDomain(a);
  const right = normalizeStoredCustomDomain(b);

  if (!left || !right) {
    return false;
  }

  return left === right;
}

export function getAppReservedHosts(): string[] {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.BETTER_AUTH_URL,
  ];

  const hosts = new Set<string>();

  for (const value of candidates) {
    if (!value) {
      continue;
    }

    try {
      const hostname = new URL(value).hostname.toLowerCase().replace(/\.$/, "");
      if (!hostname) {
        continue;
      }

      hosts.add(hostname);
      hosts.add(stripWww(hostname));
      hosts.add(`www.${stripWww(hostname)}`);
    } catch {
      // Ignore malformed app URL configuration.
    }
  }

  return [...hosts];
}

export function isReservedCustomDomain(raw: string): boolean {
  const vercelHostname = normalizeVercelCustomDomain(raw);
  const bare = normalizeStoredCustomDomain(raw);

  if (!vercelHostname || !bare) {
    return true;
  }

  if (bare === "vercel.app" || bare.endsWith(".vercel.app")) {
    return true;
  }

  for (const reserved of getAppReservedHosts()) {
    if (domainsReferToSameHost(bare, reserved)) {
      return true;
    }
  }

  return false;
}
