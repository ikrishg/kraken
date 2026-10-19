import assert from "node:assert/strict";
import test from "node:test";
import { DrizzleQueryError } from "drizzle-orm";
import { isUniqueViolation } from "@/lib/db-errors";

test("isUniqueViolation reads code on the error object", () => {
  assert.equal(isUniqueViolation({ code: "23505" }), true);
  assert.equal(isUniqueViolation({ code: "23503" }), false);
});

test("isUniqueViolation reads code on DrizzleQueryError.cause", () => {
  const cause = Object.assign(new Error("duplicate key"), { code: "23505" });
  const wrapped = new DrizzleQueryError("update ...", [], cause);

  assert.equal(isUniqueViolation(wrapped), true);
});
