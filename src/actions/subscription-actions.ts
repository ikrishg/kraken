"use server";

import { and, eq, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { jsx } from "react/jsx-runtime";
import { follows, publications, subscribers, user } from "@/db/schema";
import { SubscriptionConfirmationEmail } from "@/emails/subscription-confirmation-email";
import { SubscriptionOptInEmail } from "@/emails/subscription-opt-in-email";
import { useAuthenticated } from "@/hooks/authenticated";
import { getSession } from "@/hooks/session";
import { db } from "@/lib/db";
import { getAppUrl, getFromEmail, getResendClient } from "@/lib/resend";
import { publicationUrl } from "@/lib/utils/routes";
import {
  doesSessionOwnSubscriber,
  isValidEmail,
  normalizeReturnTo,
  resolveVerifiedSubscriptionUserId,
} from "@/lib/utils/subscription";

function makeToken() {
  return crypto.randomUUID().replaceAll("-", "");
}

function redirectWithStatus(returnTo: string, status: string): never {
  const separator = returnTo.includes("?") ? "&" : "?";
  const key = returnTo.startsWith("/subscriptions") ? "status" : "subscribe";
  redirect(`${returnTo}${separator}${key}=${status}`);
}

async function sendSubscriptionEmail(input: {
  to: string;
  publicationName: string;
  publicationUsername: string;
  token: string;
  type: "confirmation" | "opt-in";
}) {
  const resend = getResendClient();
  if (!resend) {
    return false;
  }

  const appUrl = getAppUrl();
  const unsubscribeUrl = `${appUrl}/api/subscriptions/unsubscribe/${input.token}`;

  try {
    if (input.type === "confirmation") {
      const publicationUrl = `${appUrl}/~${input.publicationUsername}`;
      await resend.emails.send({
        from: getFromEmail(),
        to: input.to,
        subject: `You're subscribed to ${input.publicationName}`,
        react: jsx(SubscriptionConfirmationEmail, {
          publicationName: input.publicationName,
          publicationUsername: input.publicationUsername,
          publicationUrl,
          unsubscribeUrl,
        }),
      });
    } else {
      const confirmUrl = `${appUrl}/api/subscriptions/confirm/${input.token}`;
      await resend.emails.send({
        from: getFromEmail(),
        to: input.to,
        subject: `Confirm your subscription to ${input.publicationName}`,
        react: jsx(SubscriptionOptInEmail, {
          publicationName: input.publicationName,
          publicationUsername: input.publicationUsername,
          confirmUrl,
          unsubscribeUrl,
        }),
      });
    }

    return true;
  } catch (error) {
    console.error("Failed to send subscription email:", error);
    return false;
  }
}

async function ensureFollowRelationship(input: {
  followerId: string;
  followingId: string;
}) {
  if (input.followerId === input.followingId) {
    return;
  }

  await db
    .insert(follows)
    .values({
      followerId: input.followerId,
      followingId: input.followingId,
    })
    .onConflictDoNothing();
}

async function removeFollowRelationship(input: {
  followerId: string;
  followingId: string;
}) {
  await db
    .delete(follows)
    .where(
      and(
        eq(follows.followerId, input.followerId),
        eq(follows.followingId, input.followingId),
      ),
    );
}

export async function subscribeToPublication(formData: FormData) {
  let session = null;
  try {
    session = await getSession();
  } catch (error) {
    console.error("Failed to get session in subscribeToPublication:", error);
  }
  const returnTo = normalizeReturnTo(formData.get("returnTo"));

  const rawUsername = formData.get("publicationUsername");
  const publicationUsername =
    typeof rawUsername === "string"
      ? rawUsername.trim().toLowerCase().replace(/^@/, "")
      : "";

  const rawEmail = formData.get("email");
  const emailFromInput =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const email = emailFromInput || session?.user?.email || "";

  const rawName = formData.get("name");
  const name =
    session?.user?.name ||
    (typeof rawName === "string" ? rawName.trim() : null);
  const sessionEmail = session?.user?.email?.trim().toLowerCase() ?? null;
  const verifiedSessionUserId =
    sessionEmail && sessionEmail === email ? (session?.user?.id ?? null) : null;
  const isVerifiedSessionEmail = Boolean(verifiedSessionUserId);
  const requiresEmailConfirmation = !isVerifiedSessionEmail;

  if (!publicationUsername) {
    redirectWithStatus(returnTo, "missing-publication");
  }

  if (!email || !isValidEmail(email)) {
    redirectWithStatus(returnTo, "missing-email");
  }

  const publication = await db
    .select({
      id: publications.id,
      name: publications.name,
      ownerUsername: user.username,
      ownerUserId: user.id,
    })
    .from(publications)
    .innerJoin(user, eq(publications.userId, user.id))
    .where(eq(user.username, publicationUsername))
    .then((rows) => rows[0]);

  if (!publication) {
    redirectWithStatus(returnTo, "publication-not-found");
  }
  const effectiveUserId = resolveVerifiedSubscriptionUserId({
    sessionUserId: session?.user?.id,
    sessionEmail: session?.user?.email,
    targetEmail: email,
  });
  const effectiveName = isVerifiedSessionEmail
    ? session?.user?.name || name
    : name;

  const existing = await db
    .select({ id: subscribers.id, token: subscribers.token })
    .from(subscribers)
    .where(
      and(
        eq(subscribers.publicationId, publication.id),
        eq(subscribers.email, email),
      ),
    )
    .then((rows) => rows[0]);

  let token = existing?.token;

  if (existing) {
    await db
      .update(subscribers)
      .set({
        userId: effectiveUserId,
        name: effectiveName,
        emailNotificationsEnabled: !requiresEmailConfirmation,
      })
      .where(eq(subscribers.id, existing.id));
  } else {
    token = makeToken();

    await db.insert(subscribers).values({
      publicationId: publication.id,
      email,
      name: effectiveName,
      userId: effectiveUserId,
      emailNotificationsEnabled: !requiresEmailConfirmation,
      token,
    });
  }

  let subscriptionEmailSent = true;
  if (token && publication.ownerUsername) {
    if (requiresEmailConfirmation) {
      subscriptionEmailSent = await sendSubscriptionEmail({
        to: email,
        publicationName: publication.name,
        publicationUsername: publication.ownerUsername,
        token,
        type: "opt-in",
      });
    } else {
      subscriptionEmailSent = await sendSubscriptionEmail({
        to: email,
        publicationName: publication.name,
        publicationUsername: publication.ownerUsername,
        token,
        type: "confirmation",
      });
    }
  }

  if (effectiveUserId) {
    await ensureFollowRelationship({
      followerId: effectiveUserId,
      followingId: publication.ownerUserId,
    });
  }

  revalidatePath("/subscriptions");
  revalidatePath("/");
  revalidatePath("/feed");
  revalidatePath(publicationUrl(publicationUsername));

  redirectWithStatus(
    returnTo,
    requiresEmailConfirmation
      ? subscriptionEmailSent
        ? "check-email"
        : "email-unavailable"
      : "subscribed",
  );
}

export async function followPublication(formData: FormData) {
  const session = await useAuthenticated();
  const returnTo = normalizeReturnTo(formData.get("returnTo"));

  const rawUsername = formData.get("publicationUsername");
  const publicationUsername =
    typeof rawUsername === "string"
      ? rawUsername.trim().toLowerCase().replace(/^[@~]/, "")
      : "";

  if (!publicationUsername) {
    redirectWithStatus(returnTo, "missing-publication");
  }

  const publicationOwner = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(eq(user.username, publicationUsername))
    .then((rows) => rows[0]);

  if (!publicationOwner) {
    redirectWithStatus(returnTo, "publication-not-found");
  }

  await ensureFollowRelationship({
    followerId: session.user.id,
    followingId: publicationOwner.id,
  });

  revalidatePath("/feed");
  revalidatePath("/subscriptions");
  revalidatePath(publicationUrl(publicationUsername));
  redirectWithStatus(returnTo, "followed");
}

export async function unfollowPublication(formData: FormData) {
  const session = await useAuthenticated();
  const returnTo = normalizeReturnTo(formData.get("returnTo"));

  const rawUsername = formData.get("publicationUsername");
  const publicationUsername =
    typeof rawUsername === "string"
      ? rawUsername.trim().toLowerCase().replace(/^[@~]/, "")
      : "";

  if (!publicationUsername) {
    redirectWithStatus(returnTo, "missing-publication");
  }

  const publicationOwner = await db
    .select({ id: user.id, username: user.username })
    .from(user)
    .where(eq(user.username, publicationUsername))
    .then((rows) => rows[0]);

  if (!publicationOwner) {
    redirectWithStatus(returnTo, "publication-not-found");
  }

  await removeFollowRelationship({
    followerId: session.user.id,
    followingId: publicationOwner.id,
  });

  revalidatePath("/feed");
  revalidatePath("/subscriptions");
  revalidatePath(publicationUrl(publicationUsername));
  redirectWithStatus(returnTo, "unfollowed");
}

export async function updateSubscriptionNotifications(formData: FormData) {
  const session = await useAuthenticated();

  const subscriberId = formData.get("subscriberId");
  const enabled = formData.get("enabled") === "true";

  if (typeof subscriberId !== "string") {
    redirect("/subscriptions?status=invalid-subscriber");
  }

  await db
    .update(subscribers)
    .set({
      emailNotificationsEnabled: enabled,
      userId: session.user.id,
    })
    .where(
      and(
        eq(subscribers.id, subscriberId),
        or(
          eq(subscribers.userId, session.user.id),
          eq(subscribers.email, session.user.email),
        ),
      ),
    );

  revalidatePath("/subscriptions");
  redirect("/subscriptions?status=updated");
}

export async function removeSubscription(formData: FormData) {
  const session = await useAuthenticated();

  const subscriberId = formData.get("subscriberId");

  if (typeof subscriberId !== "string") {
    redirect("/subscriptions?status=invalid-subscriber");
  }

  const existing = await db
    .select({
      id: subscribers.id,
      email: subscribers.email,
      userId: subscribers.userId,
      publicationOwnerId: publications.userId,
    })
    .from(subscribers)
    .innerJoin(publications, eq(subscribers.publicationId, publications.id))
    .where(eq(subscribers.id, subscriberId))
    .then((rows) =>
      rows.find((row) =>
        doesSessionOwnSubscriber({
          sessionUserId: session.user.id,
          sessionEmail: session.user.email,
          subscriberUserId: row.userId,
          subscriberEmail: row.email,
        }),
      ),
    );

  if (!existing) {
    redirect("/subscriptions?status=invalid-subscriber");
  }

  await db.delete(subscribers).where(eq(subscribers.id, existing.id));
  await removeFollowRelationship({
    followerId: session.user.id,
    followingId: existing.publicationOwnerId,
  });

  revalidatePath("/subscriptions");
  revalidatePath("/feed");
  redirect("/subscriptions?status=removed");
}
