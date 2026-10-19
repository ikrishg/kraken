import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { publications, user } from "@/db/schema";
import { db } from "@/lib/db";
import { normalizeStoredCustomDomain } from "@/lib/utils/domain";

function normalizeLookupDomain(domain: string): string {
  return normalizeStoredCustomDomain(domain);
}

async function findDomainOwner(domainKey: string) {
  return db
    .select({ username: user.username })
    .from(publications)
    .innerJoin(user, eq(publications.userId, user.id))
    .where(
      and(
        eq(publications.customDomainKey, domainKey),
        eq(publications.customDomainVerified, true),
      ),
    )
    .then((rows) => rows[0]);
}

export async function GET(request: Request) {
  const internalHeader = request.headers.get("x-kraken-proxy");
  if (internalHeader !== "1") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const domainValue = searchParams.get("domain");
  const domainKey = domainValue ? normalizeLookupDomain(domainValue) : null;

  if (!domainKey) {
    return NextResponse.json({ error: "domain-required" }, { status: 400 });
  }

  const match = await findDomainOwner(domainKey);

  if (!match?.username) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  return NextResponse.json({ username: match.username });
}
