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
    storedDomain: "attacker.example.com",
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
  });

  assert.deepEqual(outcome, { status: "forbidden" });
  assert.equal(vercelCalls, 0);
});

test("removeCustomDomainIfOwned rejects another user's domain even with www alias mismatch", async () => {
  let vercelCalls = 0;

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: "www.victim.example.com",
    storedDomain: "other.example.com",
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
  });

  assert.deepEqual(outcome, { status: "forbidden" });
  assert.equal(vercelCalls, 0);
});

test("removeCustomDomainIfOwned removes via Vercel when caller owns the domain", async () => {
  const removed: string[] = [];

  const outcome = await removeCustomDomainIfOwned({
    requestedDomain: "www.news.example.com",
    storedDomain: "news.example.com",
    removeFromVercel: async (domain) => {
      removed.push(domain);
    },
  });

  assert.deepEqual(outcome, {
    status: "removed",
    ownedDomain: "news.example.com",
  });
  assert.deepEqual(removed, ["news.example.com"]);
});

test("callerOwnsStoredDomain treats www and bare hostnames as equivalent", () => {
  assert.equal(
    callerOwnsStoredDomain("blog.example.com", "www.blog.example.com"),
    true,
  );
  assert.equal(
    callerOwnsStoredDomain("www.blog.example.com", "blog.example.com"),
    true,
  );
  assert.equal(callerOwnsStoredDomain(null, "blog.example.com"), false);
});
