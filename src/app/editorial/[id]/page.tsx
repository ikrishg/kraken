import { and, desc, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { Masthead } from "@/components/editorial";
import { EditorialWorkspace } from "@/components/editorial/EditorialWorkspace";
import { issues } from "@/db/schema";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function EditorialIssuePage({ params }: PageProps) {
  const { id } = await params;
  const session = await useOnboarded();
  const username = session.user.username;

  if (!username) {
    return null;
  }

  const initialIssues = await db
    .select({
      id: issues.id,
      title: issues.title,
      content: issues.content,
      status: issues.status,
      editionNumber: issues.editionNumber,
      updatedAt: issues.updatedAt,
      publishedAt: issues.publishedAt,
    })
    .from(issues)
    .where(and(eq(issues.userId, session.user.id), isNull(issues.deletedAt)))
    .orderBy(desc(issues.updatedAt))
    .then((rows) =>
      rows.map((row) => ({
        id: row.id,
        title: row.title,
        content: row.content,
        status:
          row.status === "published"
            ? ("published" as const)
            : ("draft" as const),
        editionNumber: row.editionNumber,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
      })),
    );

  const targetIssue = initialIssues.find((issue) => issue.id === id);

  if (!targetIssue) {
    notFound();
  }

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

        <EditorialWorkspace
          username={username}
          initialIssues={initialIssues}
          initialActiveIssueId={id}
        />
      </div>
    </main>
  );
}
