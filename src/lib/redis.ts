import { Redis } from "@upstash/redis";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";

let redisClient: Redis | null = null;

const REDIS_REQUEST_TIMEOUT_MS = 1000;

function cacheEnvironmentPrefix(): string {
  return process.env.VERCEL_ENV ?? "development";
}

export function domainCacheKey(domainKey: string): string {
  const normalized =
    normalizeStoredCustomDomain(domainKey) ||
    domainKey.trim().toLowerCase().replace(/\.$/, "");

  return `${cacheEnvironmentPrefix()}:domain:${normalized}`;
}

export async function invalidateDomainCache(domainKey: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.del(domainCacheKey(domainKey));
  } catch {
    // Ignore cache invalidation failures
  }
}

export async function invalidateDomainCacheIf(
  writeSucceeded: boolean,
  domainKey: string,
  invalidate: (domainKey: string) => Promise<void> = invalidateDomainCache,
): Promise<void> {
  if (!writeSucceeded) {
    return;
  }

  await invalidate(domainKey);
}

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  redisClient = new Redis({
    url,
    token,
    retry: { retries: 1, backoff: () => 0 },
    signal: () => AbortSignal.timeout(REDIS_REQUEST_TIMEOUT_MS),
  });

  return redisClient;
}
