import assert from "node:assert/strict";
import test from "node:test";
import {
  canVerifyStoredDomain,
  shouldApplyOwnedDomainMutation,
} from "@/lib/settings/custom-domain-verify";

test("canVerifyStoredDomain rejects non-owners", () => {
  assert.equal(
    canVerifyStoredDomain("victim.example.com", "victim.example.com"),
    true,
  );
  assert.equal(
    canVerifyStoredDomain("other.example.com", "victim.example.com"),
    false,
  );
  assert.equal(canVerifyStoredDomain(null, "victim.example.com"), false);
});

test("shouldApplyOwnedDomainMutation blocks stale verify/remove updates", () => {
  assert.equal(
    shouldApplyOwnedDomainMutation("news.example.com", "news.example.com"),
    true,
  );
  assert.equal(
    shouldApplyOwnedDomainMutation("newer.example.com", "news.example.com"),
    false,
  );
  assert.equal(shouldApplyOwnedDomainMutation(null, "news.example.com"), false);
});
