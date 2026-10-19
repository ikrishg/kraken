import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCustomDomainAdd,
  shouldBlockAddForConflict,
} from "@/lib/settings/custom-domain-add";

const emptyCurrent = {
  vercelHostname: null,
  domainKey: null,
  verified: false,
};

test("shouldBlockAddForConflict blocks another publication owner", () => {
  assert.equal(
    shouldBlockAddForConflict("news.example.com", "user-a", {
      userId: "user-b",
      domainKey: "news.example.com",
    }),
    true,
  );
});

test("executeCustomDomainAdd returns in-use without touching Vercel", async () => {
  let vercelCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "news.example.com",
    current: emptyCurrent,
    currentUserId: "user-a",
    conflictOwner: {
      userId: "user-b",
      domainKey: "news.example.com",
    },
    claimInDatabase: async () => "claimed",
    addToVercel: async () => {
      vercelCalls += 1;
      return { verified: false };
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async () => {},
  });

  assert.equal(outcome.status, "in-use");
  assert.equal(vercelCalls, 0);
});

test("executeCustomDomainAdd treats www aliases as the same ownership key conflict", async () => {
  let vercelCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "www.news.example.com",
    current: emptyCurrent,
    currentUserId: "user-a",
    conflictOwner: {
      userId: "user-b",
      domainKey: "news.example.com",
    },
    claimInDatabase: async () => "claimed",
    addToVercel: async () => {
      vercelCalls += 1;
      return { verified: false };
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async () => {},
  });

  assert.equal(outcome.status, "in-use");
  assert.equal(vercelCalls, 0);
});

test("executeCustomDomainAdd claims before adding the Vercel hostname", async () => {
  const calls: string[] = [];

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "www.new.example.com",
    current: {
      vercelHostname: "old.example.com",
      domainKey: "old.example.com",
      verified: true,
    },
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async (claim) => {
      calls.push(`claim:${claim.vercelHostname}:${claim.domainKey}`);
      return "claimed";
    },
    addToVercel: async (hostname) => {
      calls.push(`add:${hostname}`);
      return { verified: true };
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async (hostname) => {
      calls.push(`remove:${hostname}`);
    },
  });

  assert.equal(outcome.status, "verified");
  assert.deepEqual(calls, [
    "claim:www.new.example.com:new.example.com",
    "add:www.new.example.com",
    "remove:old.example.com",
  ]);
});

test("executeCustomDomainAdd rolls back after a failed Vercel add", async () => {
  let rollbackCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "new.example.com",
    current: emptyCurrent,
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async () => "claimed",
    addToVercel: async () => {
      throw new Error("vercel add failed");
    },
    rollbackClaim: async () => {
      rollbackCalls += 1;
      return true;
    },
    removePreviousFromVercel: async () => {},
  });

  assert.deepEqual(outcome, { status: "add-failed", rolledBack: true });
  assert.equal(rollbackCalls, 1);
});

test("executeCustomDomainAdd does not remove the previous domain before a successful add", async () => {
  const calls: string[] = [];

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "new.example.com",
    current: {
      vercelHostname: "old.example.com",
      domainKey: "old.example.com",
      verified: true,
    },
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async () => "claimed",
    addToVercel: async () => {
      throw new Error("vercel add failed");
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async (hostname) => {
      calls.push(hostname);
    },
  });

  assert.equal(outcome.status, "add-failed");
  assert.deepEqual(calls, []);
});

test("executeCustomDomainAdd removes the previous Vercel host when switching apex to www on the same key", async () => {
  const calls: string[] = [];

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "www.news.example.com",
    current: {
      vercelHostname: "news.example.com",
      domainKey: "news.example.com",
      verified: true,
    },
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async (claim) => {
      calls.push(`claim:${claim.vercelHostname}`);
      return "claimed";
    },
    addToVercel: async (hostname) => {
      calls.push(`add:${hostname}`);
      return { verified: false };
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async (hostname) => {
      calls.push(`remove:${hostname}`);
    },
  });

  assert.equal(outcome.status, "pending");
  assert.deepEqual(calls, [
    "claim:www.news.example.com",
    "add:www.news.example.com",
    "remove:news.example.com",
  ]);
});

test("executeCustomDomainAdd re-adds the same domain through claim and Vercel", async () => {
  const calls: string[] = [];

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "www.news.example.com",
    current: {
      vercelHostname: "www.news.example.com",
      domainKey: "news.example.com",
      verified: true,
    },
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async (claim) => {
      calls.push(`claim:${claim.vercelHostname}`);
      return "claimed";
    },
    addToVercel: async (hostname) => {
      calls.push(`add:${hostname}`);
      return { verified: false };
    },
    rollbackClaim: async () => true,
    removePreviousFromVercel: async () => {
      calls.push("remove");
    },
  });

  assert.equal(outcome.status, "pending");
  assert.deepEqual(calls, [
    "claim:www.news.example.com",
    "add:www.news.example.com",
  ]);
});

test("executeCustomDomainAdd blocks overlapping changes while verification is pending", async () => {
  let claimCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "new.example.com",
    current: {
      vercelHostname: "pending.example.com",
      domainKey: "pending.example.com",
      verified: false,
    },
    currentUserId: "user-a",
    conflictOwner: null,
    claimInDatabase: async () => {
      claimCalls += 1;
      return "claimed";
    },
    addToVercel: async () => ({ verified: true }),
    rollbackClaim: async () => true,
    removePreviousFromVercel: async () => {},
  });

  assert.equal(outcome.status, "change-in-progress");
  assert.equal(claimCalls, 0);
});
