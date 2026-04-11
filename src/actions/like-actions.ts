"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { issues, likes } from "@/db/schema";
import { useAuthenticated } from "@/hooks/authenticated";
import { db } from "@/lib/db";
import { issueUrl, publicationUrl } from "@/lib/utils/routes";
import { normalizeReturnTo } from "@/lib/utils/subscription";

async function ensurePublishedIssue(issueId: string) {
  const issue = await db
    .select({
      id: issues.id,
      editionNumber: issues.editionNumber,
    })
    .from(issues)
    .where(
      and(
        eq(issues.id, issueId),
        eq(issues.status, "published"),
        isNull(issues.deletedAt),
      ),
    )
    .then((rows) => rows[0]);

  if (!issue) {
    throw new Error("Issue not found.");
  }

  return issue;
}

function revalidateLikePaths(input: {
  returnTo: string;
  publicationUsername: string;
  editionNumber: number;
}) {
  revalidatePath(input.returnTo);
  revalidatePath("/feed");
  revalidatePath(publicationUrl(input.publicationUsername));
  revalidatePath(issueUrl(input.publicationUsername, input.editionNumber));
  revalidatePath("/subscriptions");
}

export async function likeIssue(formData: FormData) {
  const session = await useAuthenticated();
  const issueId = formData.get("issueId");
  const publicationUsername = formData.get("publicationUsername");
  const editionNumberValue = formData.get("editionNumber");
  const returnTo = normalizeReturnTo(formData.get("returnTo"));

  if (
    typeof issueId !== "string" ||
    typeof publicationUsername !== "string" ||
    typeof editionNumberValue !== "string"
  ) {
    throw new Error("Like request is invalid.");
  }

  const issue = await ensurePublishedIssue(issueId);

  await db
    .insert(likes)
    .values({
      userId: session.user.id,
      issueId,
    })
    .onConflictDoNothing();

  revalidateLikePaths({
    returnTo,
    publicationUsername,
    editionNumber:
      Number.parseInt(editionNumberValue, 10) || issue.editionNumber,
  });
}

export async function unlikeIssue(formData: FormData) {
  const session = await useAuthenticated();
  const issueId = formData.get("issueId");
  const publicationUsername = formData.get("publicationUsername");
  const editionNumberValue = formData.get("editionNumber");
  const returnTo = normalizeReturnTo(formData.get("returnTo"));

  if (
    typeof issueId !== "string" ||
    typeof publicationUsername !== "string" ||
    typeof editionNumberValue !== "string"
  ) {
    throw new Error("Like request is invalid.");
  }

  const issue = await ensurePublishedIssue(issueId);

  await db
    .delete(likes)
    .where(and(eq(likes.issueId, issueId), eq(likes.userId, session.user.id)));

  revalidateLikePaths({
    returnTo,
    publicationUsername,
    editionNumber:
      Number.parseInt(editionNumberValue, 10) || issue.editionNumber,
  });
}
