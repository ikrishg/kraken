import assert from "node:assert/strict";
import test from "node:test";
import type { Redis } from "@upstash/redis";
import { lookupDomainUsernameWithGenerationGuard } from "@/lib/domain-proxy-cache";
import {
  domainCacheGenerationKey,
  domainCacheKey,
  invalidateDomainCache,
  readDomainCacheGeneration,
  resetRedisClientForTests,
  setDomainCacheIfGenerationMatches,
  setRedisClientForTests,
} from "@/lib/redis";

class MemoryRedis {
  private readonly values = new Map<string, string>();

  async get<T = string>(key: string): Promise<T | null> {
    const value = this.values.get(key);
    return value === undefined ? null : (value as T);
  }

  async set(key: string, value: string): Promise<"OK"> {
    this.values.set(key, value);
    return "OK";
  }

  async del(key: string): Promise<number> {
    return this.values.delete(key) ? 1 : 0;
  }

  async incr(key: string): Promise<number> {
    const next = Number(this.values.get(key) ?? "0") + 1;
    this.values.set(key, String(next));
    return next;
  }

  async eval(_script: string, keys: string[], args: string[]): Promise<number> {
    const current = this.values.get(keys[1]) ?? "0";

    if (current !== args[0]) {
      return 0;
    }

    this.values.set(keys[0], args[1]);
    return 1;
  }
}

test("setDomainCacheIfGenerationMatches rejects writes after invalidation bumps generation", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    const generationAtStart = await readDomainCacheGeneration(redis, domainKey);

    await invalidateDomainCache(domainKey);

    const wrote = await setDomainCacheIfGenerationMatches(
      redis,
      domainKey,
      generationAtStart,
      "",
      300,
    );

    assert.equal(wrote, false);
    assert.equal(await redis.get(domainCacheKey(domainKey)), null);
  } finally {
    resetRedisClientForTests();
  }
});

test("lookupDomainUsernameWithGenerationGuard does not cache stale 404 after invalidation", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    let fetchCalls = 0;
    let slowFetchStarted = false;

    const slowLookup = lookupDomainUsernameWithGenerationGuard(
      domainKey,
      async () => {
        slowFetchStarted = true;
        fetchCalls += 1;
        await new Promise((resolve) => setTimeout(resolve, 25));
        return new Response(JSON.stringify({ error: "not-found" }), {
          status: 404,
        });
      },
    );

    const slowPromise = slowLookup;

    while (!slowFetchStarted) {
      await new Promise((resolve) => setTimeout(resolve, 1));
    }

    await invalidateDomainCache(domainKey);

    const fastResult = await lookupDomainUsernameWithGenerationGuard(
      domainKey,
      async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ username: "alice" }), {
          status: 200,
        });
      },
    );

    const slowResult = await slowPromise;

    assert.equal(slowResult, null);
    assert.equal(fastResult, "alice");
    assert.equal(fetchCalls, 2);
    assert.equal(await redis.get(domainCacheKey(domainKey)), "alice");
  } finally {
    resetRedisClientForTests();
  }
});

test("invalidateDomainCache increments generation key", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    await invalidateDomainCache(domainKey);
    await invalidateDomainCache(domainKey);

    assert.equal(await redis.get(domainCacheGenerationKey(domainKey)), "2");
  } finally {
    resetRedisClientForTests();
  }
});
