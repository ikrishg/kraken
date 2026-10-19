import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  account,
  accountRelations,
  session,
  sessionRelations,
  user,
  userRelations,
  verification,
} from "@/../auth-schema";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  bio: text("bio"),
  location: text("location"),
  website: text("website"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const publications = pgTable("publications", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => user.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  customDomain: text("custom_domain"),
  customDomainKey: text("custom_domain_key").unique(),
  customDomainVerified: boolean("custom_domain_verified").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const issues = pgTable(
  "issues",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    publicationId: uuid("publication_id").references(() => publications.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    content: text("content").notNull(),
    editionNumber: integer("edition_number").notNull(),
    status: text("status").notNull().default("draft"),
    publishedAt: timestamp("published_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    index("issues_user_id_idx").on(table.userId),
    index("issues_publication_id_idx").on(table.publicationId),
    check(
      "issues_status_check",
      sql`${table.status} IN ('draft', 'published')`,
    ),
    uniqueIndex("issues_publication_id_edition_number_unique").on(
      table.publicationId,
      table.editionNumber,
    ),
  ],
);

export const follows = pgTable(
  "follows",
  {
    followerId: text("follower_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    followingId: text("following_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.followerId, table.followingId] }),
    index("follows_follower_id_idx").on(table.followerId),
    index("follows_following_id_idx").on(table.followingId),
  ],
);

export const likes = pgTable(
  "likes",
  {
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("likes_user_id_issue_id_unique").on(table.userId, table.issueId),
    index("likes_user_id_idx").on(table.userId),
    index("likes_issue_id_idx").on(table.issueId),
  ],
);

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    parentId: uuid("parent_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    deletedAt: timestamp("deleted_at"),
  },
  (table) => [
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "comments_parent_id_fkey",
    }).onDelete("set null"),
    index("comments_issue_id_idx").on(table.issueId),
    index("comments_user_id_idx").on(table.userId),
    index("comments_parent_id_idx").on(table.parentId),
  ],
);

export const subscribers = pgTable(
  "subscribers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publications.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    name: text("name"),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    emailNotificationsEnabled: boolean("email_notifications_enabled").default(
      true,
    ),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("subscribers_publication_id_email_unique").on(
      table.publicationId,
      table.email,
    ),
    index("subscribers_publication_id_idx").on(table.publicationId),
    index("subscribers_user_id_idx").on(table.userId),
  ],
);

export const issueDeliveries = pgTable(
  "issue_deliveries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),
    subscriberId: uuid("subscriber_id").references(() => subscribers.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
    resendEmailId: text("resend_email_id"),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("issue_deliveries_issue_id_idx").on(table.issueId),
    index("issue_deliveries_subscriber_id_idx").on(table.subscriberId),
    index("issue_deliveries_user_id_idx").on(table.userId),
    check(
      "issue_deliveries_status_check",
      sql`${table.status} IN ('pending', 'sent', 'failed')`,
    ),
  ],
);

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(user, {
    fields: [profiles.userId],
    references: [user.id],
  }),
}));

export const publicationsRelations = relations(
  publications,
  ({ one, many }) => ({
    owner: one(user, {
      fields: [publications.userId],
      references: [user.id],
    }),
    issues: many(issues),
    subscribers: many(subscribers),
  }),
);

export const issuesRelations = relations(issues, ({ one, many }) => ({
  author: one(user, {
    fields: [issues.userId],
    references: [user.id],
  }),
  publication: one(publications, {
    fields: [issues.publicationId],
    references: [publications.id],
  }),
  likes: many(likes),
  comments: many(comments),
  deliveries: many(issueDeliveries),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(user, {
    fields: [follows.followerId],
    references: [user.id],
    relationName: "follows_follower",
  }),
  following: one(user, {
    fields: [follows.followingId],
    references: [user.id],
    relationName: "follows_following",
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(user, {
    fields: [likes.userId],
    references: [user.id],
  }),
  issue: one(issues, {
    fields: [likes.issueId],
    references: [issues.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  issue: one(issues, {
    fields: [comments.issueId],
    references: [issues.id],
  }),
  user: one(user, {
    fields: [comments.userId],
    references: [user.id],
  }),
  parent: one(comments, {
    fields: [comments.parentId],
    references: [comments.id],
    relationName: "comment_replies",
  }),
  replies: many(comments, {
    relationName: "comment_replies",
  }),
}));

export const subscribersRelations = relations(subscribers, ({ one, many }) => ({
  publication: one(publications, {
    fields: [subscribers.publicationId],
    references: [publications.id],
  }),
  user: one(user, {
    fields: [subscribers.userId],
    references: [user.id],
  }),
  deliveries: many(issueDeliveries),
}));

export const issueDeliveriesRelations = relations(
  issueDeliveries,
  ({ one }) => ({
    issue: one(issues, {
      fields: [issueDeliveries.issueId],
      references: [issues.id],
    }),
    subscriber: one(subscribers, {
      fields: [issueDeliveries.subscriberId],
      references: [subscribers.id],
    }),
    user: one(user, {
      fields: [issueDeliveries.userId],
      references: [user.id],
    }),
  }),
);

export {
  user,
  session,
  account,
  verification,
  userRelations,
  sessionRelations,
  accountRelations,
};
