import assert from "node:assert/strict";
import test from "node:test";
import {
  getRedisClient,
  invalidateDomainCache,
  invalidateDomainCacheIf,
  resetRedisClientForTests,
  setRedisClientForTests,
} from "@/lib/redis";
import { executeCustomDomainAdd } from "@/lib/settings/custom-domain-add";
import { lookupDomainUsername } from "../../proxy";

const emptyCurrent = {
  vercelHostname: null,
  domainKey: null,
  verified: false,
};

function withBrokenRedisEnv(run: () => Promise<void>): Promise<void> {
  const previousUrl = process.env.UPSTASH_REDIS_REST_URL;
  const previousToken = process.env.UPSTASH_REDIS_REST_TOKEN;

  process.env.UPSTASH_REDIS_REST_URL = "http://not-https.example";
  process.env.UPSTASH_REDIS_REST_TOKEN = "test-token";
  resetRedisClientForTests();

  return run().finally(() => {
    process.env.UPSTASH_REDIS_REST_URL = previousUrl;
    process.env.UPSTASH_REDIS_REST_TOKEN = previousToken;
    resetRedisClientForTests();
  });
}

test("getRedisClient returns null for non-https Upstash URLs", async () => {
  await withBrokenRedisEnv(async () => {
    assert.equal(getRedisClient(), null);
    await invalidateDomainCache("news.example.com");
    await invalidateDomainCacheIf(true, "news.example.com");
  });
});

test("executeCustomDomainAdd completes when redis client cannot be created", async () => {
  await withBrokenRedisEnv(async () => {
    const outcome = await executeCustomDomainAdd({
      requestedDomain: "news.example.com",
      current: emptyCurrent,
      currentUserId: "user-a",
      conflictOwner: null,
      claimInDatabase: async () => "claimed",
      addToVercel: async () => ({ verified: true }),
      rollbackClaim: async () => true,
      removePreviousFromVercel: async () => {},
      readPublicationDomain: async () => null,
      invalidateDomainCache,
    });

    assert.equal(outcome.status, "verified");
  });
});

test("invalidateDomainCache resolves when redis eval fails", async () => {
  const throwingRedis = {
    eval: async () => {
      throw new Error("network");
    },
  };

  setRedisClientForTests(throwingRedis as never);
  try {
    await invalidateDomainCache("news.example.com");
    await invalidateDomainCacheIf(true, "news.example.com");
  } finally {
    resetRedisClientForTests();
  }
});

test("proxy lookup resolves when redis get fails", async () => {
  const throwingRedis = {
    mget: async () => {
      throw new Error("timeout");
    },
  };

  setRedisClientForTests(throwingRedis as never);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ username: "alice" }), { status: 200 });

  try {
    const username = await lookupDomainUsername(
      "news.example.com",
      "http://localhost:3000",
    );
    assert.equal(username, "alice");
  } finally {
    globalThis.fetch = originalFetch;
    resetRedisClientForTests();
  }
});

test("proxy lookup resolves when redis client cannot be created", async () => {
  await withBrokenRedisEnv(async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ username: "alice" }), { status: 200 });

    try {
      const username = await lookupDomainUsername(
        "news.example.com",
        "http://localhost:3000",
      );
      assert.equal(username, "alice");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
