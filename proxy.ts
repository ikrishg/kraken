import { type NextRequest, NextResponse } from "next/server";
import { lookupDomainUsernameWithGenerationGuard } from "./src/lib/domain-proxy-cache";
import {
  domainsReferToSameHost,
  getAppReservedHosts,
} from "./src/lib/utils/domain";

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

  for (const reserved of getAppReservedHosts()) {
    if (domainsReferToSameHost(hostname, reserved)) {
      return true;
    }
  }

  return false;
}

export async function lookupDomainUsername(
  hostname: string,
  requestUrl: string,
): Promise<string | null> {
  return lookupDomainUsernameWithGenerationGuard(hostname, (domainKey) => {
    const lookupUrl = new URL(
      `/api/internal/domain-lookup?domain=${encodeURIComponent(domainKey)}`,
      requestUrl,
    );

    return fetch(lookupUrl, {
      headers: { "x-kraken-proxy": "1" },
    });
  });
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
