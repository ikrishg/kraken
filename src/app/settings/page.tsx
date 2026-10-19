import { eq } from "drizzle-orm";
import Link from "next/link";
import {
  addCustomDomain,
  removeCustomDomain,
  updateDisplayName,
  updatePublicationTitle,
  verifyCustomDomain,
} from "@/actions/settings-actions";
import { Masthead } from "@/components/editorial";
import { Button } from "@/components/ui/button";
import { publications } from "@/db/schema";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";
import { verifyProjectDomain } from "@/lib/vercel-domains";

export const dynamic = "force-dynamic";

const statusCopy: Record<string, string> = {
  "name-updated": "Name updated.",
  "invalid-name": "Name must be at least 2 characters.",
  "publication-title-updated": "Publication title updated.",
  "invalid-publication-title":
    "Publication title must be at least 2 characters.",
  "domain-added": "Custom domain added and verified.",
  "domain-pending-verification":
    "Domain saved. Configure DNS records below, wait for propagation, then click Verify.",
  "domain-add-failed":
    "Could not add the domain on Vercel. Nothing was saved locally.",
  "domain-verified": "Domain verified successfully.",
  "domain-removed": "Custom domain removed.",
  "domain-verify-failed": "Could not verify domain yet.",
  "invalid-domain": "Please enter a valid domain.",
  "domain-in-use": "That domain is already connected to another publication.",
  "domain-forbidden":
    "You can only manage the custom domain on your own publication.",
  "domain-reserved":
    "That hostname is reserved for the Kraken app and cannot be used as a custom domain.",
};

type DomainVerificationRecord = {
  type?: string;
  domain?: string;
  value?: string;
  reason?: string;
};

function getFallbackDnsRecords(domain: string): DomainVerificationRecord[] {
  const parts = domain.split(".").filter(Boolean);

  if (parts.length <= 2) {
    return [
      {
        type: "A",
        domain: "@",
        value: "76.76.21.21",
        reason: "Use this for apex/root domains.",
      },
    ];
  }

  const host = parts.slice(0, -2).join(".");

  return [
    {
      type: "CNAME",
      domain: host,
      value: "cname.vercel-dns.com",
      reason: "Use this for subdomains.",
    },
  ];
}

interface PageProps {
  searchParams: Promise<{ status?: string; detail?: string }>;
}

export default async function SettingsPage({ searchParams }: PageProps) {
  const session = await useOnboarded();
  const { status, detail } = await searchParams;

  const publication = await db
    .select({
      id: publications.id,
      name: publications.name,
      customDomain: publications.customDomain,
      customDomainVerified: publications.customDomainVerified,
    })
    .from(publications)
    .where(eq(publications.userId, session.user.id))
    .then((rows) => rows[0]);

  let verificationRecords: DomainVerificationRecord[] = [];
  let verificationLookupError: string | null = null;

  if (publication?.customDomain && !publication.customDomainVerified) {
    try {
      const verification = await verifyProjectDomain(publication.customDomain);
      verificationRecords = verification.verification;
    } catch (error) {
      if (error instanceof Error) {
        verificationLookupError = error.message;
      }
      verificationRecords = getFallbackDnsRecords(publication.customDomain);
    }

    if (verificationRecords.length === 0) {
      verificationRecords = getFallbackDnsRecords(publication.customDomain);
    }
  }

  const notice = status ? statusCopy[status] : null;

  return (
    <main className="min-h-screen bg-paper-base">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="py-8">
          <Masthead
            userName={session.user.name}
            userImage={session.user.image}
            userUsername={session.user.username}
            showAvatar
            className="mb-8"
          />
        </div>

        <section className="max-w-5xl space-y-8 pb-12">
          <header className="space-y-3 border-b border-paper-border pb-6">
            <p className="text-meta text-paper-muted">Account Desk</p>
            <h1 className="text-headline text-paper-ink">Settings</h1>
            <p className="text-body-editorial text-paper-muted">
              Manage your profile, publication identity, and domain routing.
            </p>
          </header>

          {notice ? (
            <div className="border border-paper-border bg-white/70 px-4 py-3 text-meta-small text-paper-ink">
              <p>{notice}</p>
              {detail ? (
                <p className="mt-2 border-t border-paper-border pt-2 text-paper-muted">
                  <span className="text-paper-ink">Details:</span> {detail}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <form
              action={updateDisplayName}
              className="space-y-3 border border-paper-border bg-white/60 p-6"
            >
              <h2 className="font-family-display text-2xl text-paper-ink">
                Profile name
              </h2>
              <p className="text-meta-small text-paper-muted">
                This appears on your profile and bylines.
              </p>
              <input
                name="name"
                defaultValue={session.user.name || ""}
                className="w-full border border-paper-border bg-paper-base px-3 py-2 text-body-editorial text-paper-ink outline-none focus:border-paper-accent"
              />
              <div className="text-sm text-paper-muted">
                @{session.user.username}
              </div>
              <Button type="submit" variant="primary" className="text-sm">
                Save name
              </Button>
            </form>

            <form
              action={updatePublicationTitle}
              className="space-y-3 border border-paper-border bg-white/60 p-6"
            >
              <h2 className="font-family-display text-2xl text-paper-ink">
                Publication title
              </h2>
              <p className="text-sm text-paper-muted">
                This becomes the masthead title for /~{session.user.username}.
              </p>
              <input
                name="publicationTitle"
                defaultValue={publication?.name || ""}
                className="w-full border border-paper-border bg-paper-base px-3 py-2 text-body-editorial text-paper-ink outline-none focus:border-paper-accent"
              />
              <Button type="submit" variant="primary" className="text-sm">
                Save publication title
              </Button>
            </form>
          </div>

          <div className="space-y-4 border border-paper-border bg-white/60 p-6">
            <h2 className="font-family-display text-2xl text-paper-ink">
              Custom domain
            </h2>
            <p className="text-body-editorial text-paper-muted">
              Connect your publication to a custom domain using Vercel Domains
              API.
            </p>

            <form
              action={addCustomDomain}
              className="flex flex-col gap-3 md:flex-row"
            >
              <input
                name="customDomain"
                placeholder="news.example.com"
                defaultValue={publication?.customDomain || ""}
                className="w-full border border-paper-border bg-paper-base px-3 py-2 text-body-editorial text-paper-ink outline-none focus:border-paper-accent"
              />
              <Button type="submit" variant="primary" className="text-sm">
                Add domain
              </Button>
            </form>

            {publication?.customDomain ? (
              <div className="space-y-4 text-sm text-paper-muted">
                <div className="flex flex-wrap items-center gap-3">
                  <span>
                    Current: {publication.customDomain} (
                    {publication.customDomainVerified ? "verified" : "pending"})
                  </span>

                  <form action={verifyCustomDomain}>
                    <input
                      type="hidden"
                      name="customDomain"
                      value={publication.customDomain}
                    />
                    <Button
                      type="submit"
                      variant="secondary"
                      className="text-sm"
                    >
                      Verify domain
                    </Button>
                  </form>

                  <form action={removeCustomDomain}>
                    <input
                      type="hidden"
                      name="customDomain"
                      value={publication.customDomain}
                    />
                    <Button type="submit" variant="danger" className="text-sm">
                      Remove domain
                    </Button>
                  </form>
                </div>

                {!publication.customDomainVerified ? (
                  <div className="space-y-2 border border-paper-border bg-paper-base/70 p-4">
                    <p className="text-paper-ink">
                      Required DNS records for {publication.customDomain}:
                    </p>
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-paper-border text-left text-meta-small text-paper-ink">
                        <thead className="bg-white/60">
                          <tr>
                            <th className="border-b border-paper-border px-3 py-2">
                              Type
                            </th>
                            <th className="border-b border-paper-border px-3 py-2">
                              Host
                            </th>
                            <th className="border-b border-paper-border px-3 py-2">
                              Value
                            </th>
                            <th className="border-b border-paper-border px-3 py-2">
                              Notes
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {verificationRecords.map((record, index) => (
                            <tr
                              key={`${record.type || "record"}-${record.domain || index}`}
                            >
                              <td className="border-b border-paper-border px-3 py-2">
                                {record.type || "-"}
                              </td>
                              <td className="border-b border-paper-border px-3 py-2">
                                {record.domain || "@"}
                              </td>
                              <td className="border-b border-paper-border px-3 py-2 break-all">
                                {record.value || "-"}
                              </td>
                              <td className="border-b border-paper-border px-3 py-2">
                                {record.reason || "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p>
                      After saving DNS records at your DNS provider, allow
                      propagation and click{" "}
                      <span className="text-paper-ink">Verify domain</span>.
                    </p>
                    {verificationLookupError ? (
                      <p className="border-t border-paper-border pt-2 text-paper-muted">
                        <span className="text-paper-ink">
                          Latest Vercel response:
                        </span>{" "}
                        {verificationLookupError}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            <p className="text-sm text-paper-muted">
              You can add the domain first, then finish verification once DNS is
              live.
            </p>
          </div>

          <div className="space-y-4 border border-paper-border bg-white/60 p-6 text-body-editorial text-paper-ink">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-paper-muted">Email</span>
              <span>{session.user.email}</span>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-paper-muted">Public publication</span>
              <Link
                href={`/~${session.user.username}`}
                className="underline underline-offset-4"
              >
                /~{session.user.username}
              </Link>
            </div>
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-paper-muted">Marketing page</span>
              <Link href="/home" className="underline underline-offset-4">
                /home
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
