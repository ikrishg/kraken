import {
  domainCacheKey,
  getRedisClient,
  readDomainCacheGenerationAndValue,
  setDomainCacheIfGenerationMatches,
} from "@/lib/redis";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";

export const DOMAIN_CACHE_TTL_SECONDS = 300;

export async function readCachedDomainUsername(
  domainKey: string,
): Promise<string | null | undefined> {
  const redis = getRedisClient();

  if (!redis) {
    return undefined;
  }

  try {
    const cached = await redis.get(domainCacheKey(domainKey));

    if (cached === null || cached === undefined) {
      return undefined;
    }

    const normalized = String(cached);
    return normalized === "" ? null : normalized;
  } catch {
    return undefined;
  }
}

export async function writeCachedDomainUsername(
  domainKey: string,
  generationAtStart: string,
  username: string | null,
): Promise<boolean> {
  const redis = getRedisClient();

  if (!redis) {
    return false;
  }

  try {
    return await setDomainCacheIfGenerationMatches(
      redis,
      domainKey,
      generationAtStart,
      username ?? "",
      DOMAIN_CACHE_TTL_SECONDS,
    );
  } catch {
    return false;
  }
}

export async function lookupDomainUsernameWithGenerationGuard(
  hostname: string,
  fetchLookup: (domainKey: string) => Promise<Response>,
): Promise<string | null> {
  const domainKey = normalizeStoredCustomDomain(hostname);

  if (!domainKey) {
    return null;
  }

  const redis = getRedisClient();
  let generationAtStart = "0";
  let cached: string | null | undefined;

  if (redis) {
    const state = await readDomainCacheGenerationAndValue(redis, domainKey);
    generationAtStart = state.generation;
    cached = state.cachedUsername;
  } else {
    cached = await readCachedDomainUsername(domainKey);
  }

  if (cached !== undefined) {
    return cached;
  }

  const lookup = await fetchLookup(domainKey);

  if (!lookup.ok) {
    if (lookup.status === 404) {
      await writeCachedDomainUsername(domainKey, generationAtStart, null);
    }

    return null;
  }

  let payload: { username?: string };

  try {
    payload = (await lookup.json()) as { username?: string };
  } catch {
    return null;
  }

  const username =
    typeof payload.username === "string" && payload.username.length > 0
      ? payload.username.toLowerCase()
      : null;
  await writeCachedDomainUsername(domainKey, generationAtStart, username);

  return username;
}
