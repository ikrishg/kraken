import assert from "node:assert/strict";
import test from "node:test";
import { domainsReferToSameHost, normalizeDomain } from "@/lib/utils/domain";

test("normalizeDomain extracts a hostname from user input", () => {
  assert.equal(
    normalizeDomain("HTTPS://News.Example.com/path"),
    "news.example.com",
  );
  assert.equal(normalizeDomain("blog.example.com."), "blog.example.com");
});

test("domainsReferToSameHost matches www and bare hostnames", () => {
  assert.equal(
    domainsReferToSameHost("news.example.com", "www.news.example.com"),
    true,
  );
  assert.equal(
    domainsReferToSameHost("other.example.com", "news.example.com"),
    false,
  );
});

test("normalizeDomain rejects invalid hosts", () => {
  assert.equal(normalizeDomain("localhost"), "");
  assert.equal(normalizeDomain("bad..example.com"), "");
  assert.equal(normalizeDomain("news.example.com:3000"), "");
  assert.equal(normalizeDomain(".example.com"), "");
});
