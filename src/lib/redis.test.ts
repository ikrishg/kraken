import assert from "node:assert/strict";
import test from "node:test";
import {
  domainCacheKey,
  invalidateDomainCacheIf,
} from "@/lib/redis";

test("domainCacheKey normalizes www hosts to the stored domain key", () => {
  const previousEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";

  assert.equal(
    domainCacheKey("www.news.example.com"),
    "preview:domain:news.example.com",
  );

  process.env.VERCEL_ENV = previousEnv;
});

test("invalidateDomainCacheIf only invalidates after a guarded write succeeds", async () => {
  const invalidated: string[] = [];

  await invalidateDomainCacheIf(
    false,
    "news.example.com",
    async (domainKey) => {
      invalidated.push(domainKey);
    },
  );

  assert.deepEqual(invalidated, []);

  await invalidateDomainCacheIf(
    true,
    "news.example.com",
    async (domainKey) => {
      invalidated.push(domainKey);
    },
  );

  assert.deepEqual(invalidated, ["news.example.com"]);
});
