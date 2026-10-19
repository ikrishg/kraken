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

export function normalizeStoredCustomDomain(raw: string): string {
  const normalized = normalizeDomain(raw);

  if (!normalized) {
    return "";
  }

  return stripWww(normalized);
}

export function domainsReferToSameHost(a: string, b: string): boolean {
  const left = normalizeStoredCustomDomain(a) || normalizeDomain(a);
  const right = normalizeStoredCustomDomain(b) || normalizeDomain(b);

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
  const bare = normalizeStoredCustomDomain(raw);

  if (!bare) {
    return true;
  }

  if (bare.endsWith(".vercel.app")) {
    return true;
  }

  for (const reserved of getAppReservedHosts()) {
    if (domainsReferToSameHost(bare, reserved)) {
      return true;
    }
  }

  return false;
}
