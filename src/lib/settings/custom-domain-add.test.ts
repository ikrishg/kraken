import assert from "node:assert/strict";
import test from "node:test";
import {
  executeCustomDomainAdd,
  shouldBlockAddForConflict,
} from "@/lib/settings/custom-domain-add";

test("shouldBlockAddForConflict blocks another publication owner", () => {
  assert.equal(
    shouldBlockAddForConflict("news.example.com", "user-a", {
      userId: "user-b",
      bareDomain: "news.example.com",
    }),
    true,
  );
  assert.equal(
    shouldBlockAddForConflict("news.example.com", "user-a", {
      userId: "user-a",
      bareDomain: "news.example.com",
    }),
    false,
  );
});

test("executeCustomDomainAdd returns in-use for an existing owner", async () => {
  let vercelCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "news.example.com",
    currentDomain: null,
    currentUserId: "user-a",
    conflictOwner: {
      userId: "user-b",
      bareDomain: "news.example.com",
    },
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
    addToVercel: async () => {
      vercelCalls += 1;
      return { verified: false };
    },
    claimInDatabase: async () => "claimed",
    restoreDatabase: async () => {},
  });

  assert.equal(outcome.status, "in-use");
  assert.equal(vercelCalls, 0);
});

test("executeCustomDomainAdd treats www aliases as the same bare domain conflict", async () => {
  let vercelCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "www.news.example.com",
    currentDomain: null,
    currentUserId: "user-a",
    conflictOwner: {
      userId: "user-b",
      bareDomain: "news.example.com",
    },
    removeFromVercel: async () => {
      vercelCalls += 1;
    },
    addToVercel: async () => {
      vercelCalls += 1;
      return { verified: false };
    },
    claimInDatabase: async () => "claimed",
    restoreDatabase: async () => {},
  });

  assert.equal(outcome.status, "in-use");
  assert.equal(vercelCalls, 0);
});

test("executeCustomDomainAdd removes the previous domain before adding the next one", async () => {
  const calls: string[] = [];

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "new.example.com",
    currentDomain: "old.example.com",
    currentUserId: "user-a",
    conflictOwner: null,
    removeFromVercel: async (domain) => {
      calls.push(`remove:${domain}`);
    },
    addToVercel: async (domain) => {
      calls.push(`add:${domain}`);
      return { verified: true };
    },
    claimInDatabase: async (domain) => {
      calls.push(`claim:${domain}`);
      return "claimed";
    },
    restoreDatabase: async () => {},
  });

  assert.equal(outcome.status, "verified");
  assert.deepEqual(calls, [
    "remove:old.example.com",
    "claim:new.example.com",
    "add:new.example.com",
  ]);
});

test("executeCustomDomainAdd aborts when removing the previous domain fails", async () => {
  let claimCalls = 0;

  const outcome = await executeCustomDomainAdd({
    requestedDomain: "new.example.com",
    currentDomain: "old.example.com",
    currentUserId: "user-a",
    conflictOwner: null,
    removeFromVercel: async () => {
      throw new Error("vercel remove failed");
    },
    addToVercel: async () => ({ verified: true }),
    claimInDatabase: async () => {
      claimCalls += 1;
      return "claimed";
    },
    restoreDatabase: async () => {},
  });

  assert.equal(outcome.status, "remove-previous-failed");
  assert.equal(claimCalls, 0);
});
