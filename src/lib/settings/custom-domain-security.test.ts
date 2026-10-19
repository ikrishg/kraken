import assert from "node:assert/strict";
import test from "node:test";
import {
  callerOwnsStoredDomain,
  removeCustomDomainIfOwned,
} from "@/lib/settings/custom-domain-security";

test("removeCustomDomainIfOwned rejects when stored domain does not match request", async () => {
  let vercelCalls = 0;

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: "victim.example.com",
    storedVercelHostname: "attacker.example.com",
    storedDomainKey: "attacker.example.com",
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
  });

  assert.deepEqual(outcome, { status: "forbidden" });
  assert.equal(vercelCalls, 0);
});

test("removeCustomDomainIfOwned rejects null stored domain without calling Vercel", async () => {
  let vercelCalls = 0;

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: "news.example.com",
    storedVercelHostname: null,
    storedDomainKey: null,
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
  });

  assert.deepEqual(outcome, { status: "forbidden" });
  assert.equal(vercelCalls, 0);
});

test("removeCustomDomainIfOwned removes via the stored Vercel hostname", async () => {
  const removed: string[] = [];

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: "www.news.example.com",
    storedVercelHostname: "www.news.example.com",
    storedDomainKey: "news.example.com",
    removeFromVercel: async (hostname) => {
      removed.push(hostname);
    },
  });

  assert.deepEqual(outcome, {
    status: "removed",
    vercelHostname: "www.news.example.com",
    domainKey: "news.example.com",
  });
  assert.deepEqual(removed, ["www.news.example.com"]);
});

test("callerOwnsStoredDomain treats www and bare hostnames as equivalent", () => {
  assert.equal(
    callerOwnsStoredDomain("blog.example.com", "www.blog.example.com"),
    true,
  );
  assert.equal(callerOwnsStoredDomain(null, "blog.example.com"), false);
});
