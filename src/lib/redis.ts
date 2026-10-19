import { Redis } from "@upstash/redis";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";

let redisClient: Redis | null = null;
let redisClientInitFailed = false;

const REDIS_REQUEST_TIMEOUT_MS = 1000;

const DOMAIN_CACHE_SET_IF_GENERATION_SCRIPT = `
local current = redis.call('GET', KEYS[2])
if current == false then
  current = '0'
end
if current ~= ARGV[1] then
  return 0
end
redis.call('SET', KEYS[1], ARGV[2], 'EX', ARGV[3])
return 1
`;

function cacheEnvironmentPrefix(): string {
  return process.env.VERCEL_ENV ?? "development";
}

function normalizeDomainKey(domainKey: string): string {
  return (
    normalizeStoredCustomDomain(domainKey) ||
    domainKey.trim().toLowerCase().replace(/\.$/, "")
  );
}

function isValidUpstashRestUrl(url: string): boolean {
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}

export function domainCacheKey(domainKey: string): string {
  return `${cacheEnvironmentPrefix()}:domain:${normalizeDomainKey(domainKey)}`;
}

export function domainCacheGenerationKey(domainKey: string): string {
  return `${domainCacheKey(domainKey)}:gen`;
}

export async function readDomainCacheGeneration(
  redis: Redis,
  domainKey: string,
): Promise<string> {
  const value = await redis.get<string>(domainCacheGenerationKey(domainKey));
  return value ?? "0";
}

export async function setDomainCacheIfGenerationMatches(
  redis: Redis,
  domainKey: string,
  generationAtStart: string,
  value: string,
  ttlSeconds: number,
): Promise<boolean> {
  const result = await redis.eval(
    DOMAIN_CACHE_SET_IF_GENERATION_SCRIPT,
    [domainCacheKey(domainKey), domainCacheGenerationKey(domainKey)],
    [generationAtStart, value, String(ttlSeconds)],
  );

  return result === 1;
}

export async function invalidateDomainCache(domainKey: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) {
    return;
  }

  try {
    await redis.incr(domainCacheGenerationKey(domainKey));
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

export function resetRedisClientForTests(): void {
  redisClient = null;
  redisClientInitFailed = false;
}

export function setRedisClientForTests(client: Redis | null): void {
  redisClient = client;
  redisClientInitFailed = false;
}

export function getRedisClient(): Redis | null {
  if (redisClient) {
    return redisClient;
  }

  if (redisClientInitFailed) {
    return null;
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token || !isValidUpstashRestUrl(url)) {
    if (url && token && !isValidUpstashRestUrl(url)) {
      redisClientInitFailed = true;
    }
    return null;
  }

  try {
    redisClient = new Redis({
      url,
      token,
      retry: { retries: 1, backoff: () => 0 },
      signal: () => AbortSignal.timeout(REDIS_REQUEST_TIMEOUT_MS),
    });
  } catch {
    redisClientInitFailed = true;
    redisClient = null;
    return null;
  }

  return redisClient;
}
