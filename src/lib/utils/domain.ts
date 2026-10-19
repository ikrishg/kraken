function stripWww(hostname: string): string {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

export function domainsReferToSameHost(a: string, b: string): boolean {
  const left = normalizeDomain(a);
  const right = normalizeDomain(b);

  if (!left || !right) {
    return false;
  }

  if (left === right) {
    return true;
  }

  return stripWww(left) === stripWww(right);
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
