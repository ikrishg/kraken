import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

const DOMAIN_CACHE_TTL_SECONDS = 300;

function normalizeHostname(value: string): string {
  return value.trim().toLowerCase().replace(/\.$/, "").split(":")[0] || "";
}

function getHandleUsername(pathname: string): string | null {
  if (!pathname.startsWith("/@") && !pathname.startsWith("/~")) {
    return null;
  }

  const withoutLeadingSlash = pathname.slice(1);
  const firstSegment = withoutLeadingSlash.split("/")[0];
  const username = firstSegment.slice(1).trim().toLowerCase();

  return username.length > 0 ? username : null;
}

function isPrimaryHost(hostname: string): boolean {
  if (hostname === "localhost" || hostname === "127.0.0.1") {
    return true;
  }

  if (hostname.endsWith(".vercel.app")) {
    return true;
  }

  const appUrl = process.env.BETTER_AUTH_URL;
  if (!appUrl) {
    return false;
  }

  try {
    const appHost = new URL(appUrl).hostname;
    return hostname === appHost;
  } catch {
    return false;
  }
}

function getRedis(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return null;
  }

  return new Redis({ url, token });
}

async function lookupDomainUsername(
  domain: string,
  requestUrl: string,
): Promise<string | null> {
  const redis = getRedis();
  const cacheKey = `domain:${domain}`;

  if (redis) {
    try {
      const cached = await redis.get<string>(cacheKey);
      if (cached !== null) {
        return cached === "" ? null : cached;
      }
    } catch {
      // Cache unavailable, proceed with API lookup
    }
  }

  const lookupUrl = new URL(
    `/api/internal/domain-lookup?domain=${encodeURIComponent(domain)}`,
    requestUrl,
  );

  const lookup = await fetch(lookupUrl, {
    headers: { "x-kraken-proxy": "1" },
  });

  if (!lookup.ok) {
    if (redis) {
      try {
        await redis.set(cacheKey, "", { ex: DOMAIN_CACHE_TTL_SECONDS });
      } catch {
        // Ignore cache write failure
      }
    }
    return null;
  }

  const payload = (await lookup.json()) as { username?: string };
  const username = payload.username ? payload.username.toLowerCase() : null;

  if (redis) {
    try {
      await redis.set(cacheKey, username ?? "", {
        ex: DOMAIN_CACHE_TTL_SECONDS,
      });
    } catch {
      // Ignore cache write failure
    }
  }

  return username;
}

export async function proxy(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const hostHeader = request.headers.get("host");
  const hostname = normalizeHostname(forwardedHost || hostHeader || "");
  const pathname = request.nextUrl.pathname;

  if (isPrimaryHost(hostname)) {
    return NextResponse.next();
  }

  const search = request.nextUrl.search;
  const ownerUsername = await lookupDomainUsername(hostname, request.url);

  if (!ownerUsername) {
    return NextResponse.next();
  }

  const handleUsername = getHandleUsername(pathname);

  if (handleUsername) {
    if (handleUsername !== ownerUsername) {
      return new NextResponse("Not Found", { status: 404 });
    }

    return NextResponse.next();
  }

  const rewriteUrl = new URL(
    `/~${ownerUsername}${pathname}${search}`,
    request.url,
  );

  return NextResponse.rewrite(rewriteUrl);
}

export const config = {
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
