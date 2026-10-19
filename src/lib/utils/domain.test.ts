import assert from "node:assert/strict";
import test from "node:test";
import {
  domainsReferToSameHost,
  isReservedCustomDomain,
  normalizeDomain,
  normalizeStoredCustomDomain,
  normalizeVercelCustomDomain,
  parseCustomDomainInput,
} from "@/lib/utils/domain";

test("normalizeDomain extracts a hostname from user input", () => {
  assert.equal(
    normalizeDomain("HTTPS://News.Example.com/path"),
    "news.example.com",
  );
  assert.equal(normalizeDomain("blog.example.com."), "blog.example.com");
});

test("normalizeStoredCustomDomain lowercases and strips www", () => {
  assert.equal(
    normalizeStoredCustomDomain("HTTPS://WWW.News.Example.com."),
    "news.example.com",
  );
  assert.equal(
    normalizeStoredCustomDomain("BLOG.EXAMPLE.COM"),
    "blog.example.com",
  );
});

test("normalizeVercelCustomDomain keeps www hostnames", () => {
  assert.equal(
    normalizeVercelCustomDomain("HTTPS://WWW.News.Example.com."),
    "www.news.example.com",
  );
});

test("parseCustomDomainInput separates Vercel hostname from ownership key", () => {
  assert.deepEqual(parseCustomDomainInput("WWW.News.Example.com."), {
    vercelHostname: "www.news.example.com",
    domainKey: "news.example.com",
  });
});

test("normalizeDomain rejects hostnames with ports", () => {
  assert.equal(normalizeDomain("news.example.com:443"), "");
  assert.equal(normalizeStoredCustomDomain("news.example.com:443"), "");
});

test("isReservedCustomDomain blocks vercel.app and app hostnames", () => {
  const previousAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  process.env.NEXT_PUBLIC_APP_URL = "https://www.kraken.example";

  assert.equal(isReservedCustomDomain("vercel.app"), true);
  assert.equal(isReservedCustomDomain("preview.vercel.app"), true);
  assert.equal(isReservedCustomDomain("www.kraken.example"), true);
  assert.equal(isReservedCustomDomain("kraken.example"), true);
  assert.equal(isReservedCustomDomain("letters.example.com"), false);

  process.env.NEXT_PUBLIC_APP_URL = previousAppUrl;
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
