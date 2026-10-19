import assert from "node:assert/strict";
import test from "node:test";
import {
  canStartDomainClaim,
  shouldRollbackClaim,
} from "@/lib/settings/custom-domain-restore";

test("canStartDomainClaim allows re-adding the same ownership key", () => {
  assert.equal(
    canStartDomainClaim("news.example.com", false, "news.example.com"),
    true,
  );
});

test("canStartDomainClaim blocks a new key while verification is pending", () => {
  assert.equal(
    canStartDomainClaim("pending.example.com", false, "new.example.com"),
    false,
  );
});

test("shouldRollbackClaim only rolls back the active claim", () => {
  assert.equal(
    shouldRollbackClaim("claimed.example.com", "claimed.example.com"),
    true,
  );
  assert.equal(
    shouldRollbackClaim("claimed.example.com", "newer.example.com"),
    false,
  );
});
