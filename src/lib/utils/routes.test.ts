import assert from "node:assert/strict";
import test from "node:test";
import {
  editorialUrl,
  issueUrl,
  profileUrl,
  publicationUrl,
} from "@/lib/utils/routes";

test("publicationUrl builds canonical publication path", () => {
  assert.equal(publicationUrl("alice"), "/~alice");
  assert.equal(publicationUrl("bob-99"), "/~bob-99");
});

test("issueUrl builds canonical issue path", () => {
  assert.equal(issueUrl("alice", 1), "/~alice/1");
  assert.equal(issueUrl("alice", 12), "/~alice/12");
});

test("profileUrl builds @-style profile path", () => {
  assert.equal(profileUrl("alice"), "/@alice");
});

test("editorialUrl without id returns workspace root", () => {
  assert.equal(editorialUrl(), "/editorial");
  assert.equal(editorialUrl(undefined), "/editorial");
});

test("editorialUrl with id returns focused workspace path", () => {
  assert.equal(editorialUrl("abc123"), "/editorial/abc123");
});
