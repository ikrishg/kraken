import assert from "node:assert/strict";
import test from "node:test";
import type { Redis } from "@upstash/redis";
import {
  lookupDomainUsernameWithGenerationGuard,
  readCachedDomainUsername,
} from "@/lib/domain-proxy-cache";
import {
  domainCacheGenerationKey,
  domainCacheKey,
  invalidateDomainCache,
  readDomainCacheGeneration,
  resetRedisClientForTests,
  setDomainCacheIfGenerationMatches,
  setRedisClientForTests,
} from "@/lib/redis";

function upstashDeserializeStoredValue(stored: string): unknown {
  try {
    return JSON.parse(stored);
  } catch {
    return stored;
  }
}

class MemoryRedis {
  private readonly values = new Map<string, string>();

  async get<T = string>(key: string): Promise<T | null> {
    const value = this.values.get(key);
    if (value === undefined) {
      return null;
    }

    return upstashDeserializeStoredValue(value) as T;
  }

  async mget<T extends unknown[]>(...keys: string[]): Promise<T> {
    const results = keys.map((key) => {
      const value = this.values.get(key);
      if (value === undefined) {
        return null;
      }
      return upstashDeserializeStoredValue(value);
    });

    return results as T;
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
    if (keys.length === 2 && args.length === 0) {
      await this.incr(keys[0]);
      await this.del(keys[1]);
      return 1;
    }

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

    assert.equal(await redis.get(domainCacheGenerationKey(domainKey)), 2);
  } finally {
    resetRedisClientForTests();
  }
});

test("readCachedDomainUsername preserves falsy-looking usernames from Upstash deserialization", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    const key = domainCacheKey(domainKey);

    await redis.set(key, "0");
    assert.equal(await readCachedDomainUsername(domainKey), "0");

    await redis.set(key, "false");
    assert.equal(await readCachedDomainUsername(domainKey), "false");

    await redis.set(key, "123");
    assert.equal(await readCachedDomainUsername(domainKey), "123");
  } finally {
    resetRedisClientForTests();
  }
});

test("lookupDomainUsernameWithGenerationGuard returns cached username 0 without refetch", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    await redis.set(domainCacheKey(domainKey), "0");

    let fetchCalls = 0;
    const username = await lookupDomainUsernameWithGenerationGuard(
      domainKey,
      async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ username: "ignored" }), {
          status: 200,
        });
      },
    );

    assert.equal(username, "0");
    assert.equal(fetchCalls, 0);
  } finally {
    resetRedisClientForTests();
  }
});

test("readCachedDomainUsername preserves username null when redis returns raw strings", async () => {
  const rawRedis = {
    get: async (key: string) =>
      key === domainCacheKey("news.example.com") ? "null" : null,
  };

  setRedisClientForTests(rawRedis as never);
  try {
    assert.equal(await readCachedDomainUsername("news.example.com"), "null");
  } finally {
    resetRedisClientForTests();
  }
});

test("lookupDomainUsernameWithGenerationGuard returns cached username false without refetch", async () => {
  const redis = new MemoryRedis() as unknown as Redis;
  setRedisClientForTests(redis);
  try {
    const domainKey = "news.example.com";
    await redis.set(domainCacheKey(domainKey), "false");

    let fetchCalls = 0;
    const username = await lookupDomainUsernameWithGenerationGuard(
      domainKey,
      async () => {
        fetchCalls += 1;
        return new Response(JSON.stringify({ username: "ignored" }), {
          status: 200,
        });
      },
    );

    assert.equal(username, "false");
    assert.equal(fetchCalls, 0);
  } finally {
    resetRedisClientForTests();
  }
});
