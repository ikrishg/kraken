import assert from "node:assert/strict";
import test from "node:test";
import { domainCacheKey, invalidateDomainCacheIf } from "@/lib/redis";

test("domainCacheKey normalizes www hosts to the stored domain key", () => {
  const previousEnv = process.env.VERCEL_ENV;
  process.env.VERCEL_ENV = "preview";

  assert.equal(
    domainCacheKey("www.news.example.com"),
    "preview:domain:news.example.com",
  );

  process.env.VERCEL_ENV = previousEnv;
});

test("invalidateDomainCacheIf resolves without redis configured", async () => {
  await invalidateDomainCacheIf(false, "news.example.com");
  await invalidateDomainCacheIf(true, "news.example.com");
});

test("invalidateDomainCacheIf delegates to the invalidate callback on success", async () => {
  const calls: string[] = [];
  const invalidate = async (domainKey: string) => {
    calls.push(domainKey);
  };

  await invalidateDomainCacheIf(false, "news.example.com", invalidate);
  assert.equal(calls.length, 0);

  await invalidateDomainCacheIf(true, "news.example.com", invalidate);
  assert.deepEqual(calls, ["news.example.com"]);
});
