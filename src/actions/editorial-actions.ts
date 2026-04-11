"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { jsx } from "react/jsx-runtime";
import {
  issueDeliveries,
  issues,
  publications,
  subscribers,
} from "@/db/schema";
import { NewIssueEmail } from "@/emails/new-issue-email";
import { useOnboarded } from "@/hooks/onboarded";
import { db } from "@/lib/db";
import { getAppUrl, getFromEmail, getResendClient } from "@/lib/resend";
import { parsePublishDateInput } from "@/lib/utils/publish-date";
import { issueUrl, publicationUrl } from "@/lib/utils/routes";

export type EditorialIssueRecord = {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  editionNumber: number;
  updatedAt: Date;
  publishedAt: Date | null;
};

function getRequiredUsername(session: {
  user: { username?: string | null };
}): string {
  const username = session.user.username;

  if (!username) {
    throw new Error("Onboarded user is missing a username");
  }

  return username;
}

async function getPublicationId(userId: string) {
  const publication = await db
    .select({ id: publications.id })
    .from(publications)
    .where(eq(publications.userId, userId))
    .then((rows) => rows[0]);

  return publication?.id;
}

async function ensurePublication(userId: string, fallbackName: string) {
  const existingPublicationId = await getPublicationId(userId);

  if (existingPublicationId) {
    return existingPublicationId;
  }

  const created = await db
    .insert(publications)
    .values({
      userId,
      name: fallbackName,
      updatedAt: new Date(),
    })
    .returning({ id: publications.id })
    .then((rows) => rows[0]);

  return created.id;
}

function mapIssueRecord(row: {
  id: string;
  title: string;
  content: string;
  status: string;
  editionNumber: number;
  updatedAt: Date;
  publishedAt: Date | null;
}): EditorialIssueRecord {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: row.status === "published" ? "published" : "draft",
    editionNumber: row.editionNumber,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt,
  };
}

function revalidateEditorialPaths(
  username: string,
  editionNumber?: number | null,
) {
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath("/editorial");
  revalidatePath(publicationUrl(username));
  if (editionNumber) {
    revalidatePath(issueUrl(username, editionNumber));
  }
}

export async function createEditorialDraft(): Promise<EditorialIssueRecord> {
  const session = await useOnboarded();
  const username = getRequiredUsername(session);
  const publicationId = await ensurePublication(
    session.user.id,
    `${session.user.name || username} Publication`,
  );

  const highestEdition = await db
    .select({ editionNumber: issues.editionNumber })
    .from(issues)
    .where(and(eq(issues.userId, session.user.id), isNull(issues.deletedAt)))
    .orderBy(desc(issues.editionNumber))
    .limit(1)
    .then((rows) => rows[0]);

  const nextEditionNumber = (highestEdition?.editionNumber ?? 0) + 1;

  const created = await db
    .insert(issues)
    .values({
      userId: session.user.id,
      publicationId,
      title: "Untitled Draft",
      content: "",
      status: "draft",
      editionNumber: nextEditionNumber,
      updatedAt: new Date(),
    })
    .returning({
      id: issues.id,
      title: issues.title,
      content: issues.content,
      status: issues.status,
      editionNumber: issues.editionNumber,
      updatedAt: issues.updatedAt,
      publishedAt: issues.publishedAt,
    })
    .then((rows) => rows[0]);

  revalidateEditorialPaths(username);

  return mapIssueRecord(created);
}

export async function saveEditorialIssue(input: {
  issueId: string;
  title: string;
  content: string;
}): Promise<EditorialIssueRecord> {
  const session = await useOnboarded();
  const username = getRequiredUsername(session);

  const updated = await db
    .update(issues)
    .set({
      title: input.title,
      content: input.content,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(issues.id, input.issueId),
        eq(issues.userId, session.user.id),
        isNull(issues.deletedAt),
      ),
    )
    .returning({
      id: issues.id,
      title: issues.title,
      content: issues.content,
      status: issues.status,
      editionNumber: issues.editionNumber,
      updatedAt: issues.updatedAt,
      publishedAt: issues.publishedAt,
    })
    .then((rows) => rows[0]);

  if (!updated) {
    throw new Error("Issue not found");
  }

  revalidateEditorialPaths(
    username,
    updated.status === "published" ? updated.editionNumber : null,
  );

  return mapIssueRecord(updated);
}

export async function publishEditorialIssue(input: {
  issueId: string;
  title: string;
  content: string;
  publishedOn?: string;
}): Promise<EditorialIssueRecord> {
  const session = await useOnboarded();
  const username = getRequiredUsername(session);
  const publishTimestamp = parsePublishDateInput(input.publishedOn);

  // Verify issue exists and belongs to user
  const existingIssue = await db
    .select({ id: issues.id })
    .from(issues)
    .where(
      and(
        eq(issues.id, input.issueId),
        eq(issues.userId, session.user.id),
        isNull(issues.deletedAt),
      ),
    )
    .then((rows) => rows[0]);

  if (!existingIssue) {
    throw new Error(
      "Issue not found or you do not have permission to publish it",
    );
  }

  const publicationId = await ensurePublication(
    session.user.id,
    `${session.user.name || username} Publication`,
  );

  const published = await db
    .update(issues)
    .set({
      publicationId,
      title: input.title,
      content: input.content,
      status: "published",
      publishedAt: publishTimestamp,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(issues.id, input.issueId),
        eq(issues.userId, session.user.id),
        isNull(issues.deletedAt),
      ),
    )
    .returning({
      id: issues.id,
      title: issues.title,
      content: issues.content,
      status: issues.status,
      editionNumber: issues.editionNumber,
      updatedAt: issues.updatedAt,
      publishedAt: issues.publishedAt,
    })
    .then((rows) => rows[0]);

  if (!published) {
    throw new Error("Issue not found");
  }

  const resend = getResendClient();
  const publication = publicationId
    ? await db
        .select({ name: publications.name })
        .from(publications)
        .where(eq(publications.id, publicationId))
        .then((rows) => rows[0])
    : null;
  const publicationName =
    publication?.name || session.user.name || username || "KRAKEN";

  if (resend && publicationId && username) {
    const activeSubscribers = await db
      .select({
        id: subscribers.id,
        email: subscribers.email,
        token: subscribers.token,
      })
      .from(subscribers)
      .where(
        and(
          eq(subscribers.publicationId, publicationId),
          eq(subscribers.emailNotificationsEnabled, true),
        ),
      );

    if (activeSubscribers.length > 0) {
      const appUrl = getAppUrl();

      for (const subscriber of activeSubscribers) {
        const unsubscribeUrl = `${appUrl}/api/subscriptions/unsubscribe/${subscriber.token}`;

        try {
          const result = await resend.emails.send({
            from: getFromEmail(),
            to: subscriber.email,
            subject: `${input.title} · ${session.user.name || username}`,
            react: jsx(NewIssueEmail, {
              publicationName,
              issueTitle: input.title,
              issueContent: input.content,
              signOff: publicationName,
              unsubscribeUrl,
            }),
          });

          await db.insert(issueDeliveries).values({
            issueId: published.id,
            subscriberId: subscriber.id,
            userId: session.user.id,
            resendEmailId: result.data?.id ?? null,
            status: "sent",
          });
        } catch {
          await db.insert(issueDeliveries).values({
            issueId: published.id,
            subscriberId: subscriber.id,
            userId: session.user.id,
            status: "failed",
          });
        }
      }
    }
  }

  revalidateEditorialPaths(username, published.editionNumber);

  return mapIssueRecord(published);
}

export async function testSendIssueEmail(input: {
  issueId: string;
  title: string;
  content: string;
}) {
  const session = await useOnboarded();
  const username = getRequiredUsername(session);
  const resend = getResendClient();

  if (!resend || !session.user.email) {
    throw new Error("Email service is not configured.");
  }

  const publication = await db
    .select({ name: publications.name })
    .from(publications)
    .where(eq(publications.userId, session.user.id))
    .then((rows) => rows[0]);

  const publicationName =
    publication?.name || session.user.name || username || "KRAKEN";
  const appUrl = getAppUrl();

  await resend.emails.send({
    from: getFromEmail(),
    to: session.user.email,
    subject: `Test send: ${input.title}`,
    react: jsx(NewIssueEmail, {
      publicationName,
      issueTitle: input.title,
      issueContent: input.content,
      signOff: publicationName,
      unsubscribeUrl: `${appUrl}/subscriptions`,
    }),
  });
}
