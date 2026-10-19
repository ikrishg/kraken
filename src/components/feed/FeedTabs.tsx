"use client";

import { Tabs } from "@base-ui/react/tabs";
import Image from "next/image";
import Link from "next/link";
import type { Article } from "@/components/editorial";
import {
  ArticleCard,
  EditorialGrid,
  IssueLikeControl,
} from "@/components/editorial";
import type { FollowEntry, SubscriptionEntry } from "@/lib/queries/updates";
import { assignCardSizes, getCardGridClasses } from "@/lib/utils/card-layout";
import { issueUrl, publicationUrl } from "@/lib/utils/routes";

type FeedTab = "articles" | "subscriptions" | "follows" | "likes";

interface FeedTabsProps {
  articles: Article[];
  follows: FollowEntry[];
  subscriptions: SubscriptionEntry[];
  likedArticles: Article[];
}

const TAB_LABELS: { id: FeedTab; label: string }[] = [
  { id: "articles", label: "Articles" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "follows", label: "Follows" },
  { id: "likes", label: "Likes" },
];

const tabButtonClass = ({ active }: { active: boolean }) =>
  `px-5 py-3 text-meta tracking-wider uppercase transition-colors ${
    active
      ? "border-b-2 border-paper-ink text-paper-ink font-medium -mb-px"
      : "text-paper-muted hover:text-paper-ink"
  }`;

export function FeedTabs({
  articles,
  follows,
  subscriptions,
  likedArticles,
}: FeedTabsProps) {
  return (
    <Tabs.Root defaultValue="articles">
      <Tabs.List className="flex border-b border-paper-border mb-8">
        {TAB_LABELS.map((tab) => (
          <Tabs.Tab key={tab.id} value={tab.id} className={tabButtonClass}>
            {tab.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>

      <Tabs.Panel value="articles">
        <ArticlesTab articles={articles} />
      </Tabs.Panel>
      <Tabs.Panel value="subscriptions">
        <SubscriptionsTab subscriptions={subscriptions} />
      </Tabs.Panel>
      <Tabs.Panel value="follows">
        <FollowsTab follows={follows} />
      </Tabs.Panel>
      <Tabs.Panel value="likes">
        <LikesTab articles={likedArticles} />
      </Tabs.Panel>
    </Tabs.Root>
  );
}

function ArticlesTab({ articles }: { articles: Article[] }) {
  const cardSizes = assignCardSizes(articles.length);

  if (articles.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-body-editorial text-paper-muted">
          Your feed is empty. Subscribe to writers and they will appear here
          automatically.
        </p>
      </div>
    );
  }

  return (
    <EditorialGrid>
      {articles.map((article, index) => {
        const size = cardSizes[index];
        const gridClasses = getCardGridClasses(size);
        return (
          <div key={article.id} className={`${gridClasses} group h-full`}>
            <ArticleCard
              article={article}
              href={issueUrl(
                article.userUsername || "unknown",
                article.editionNumber,
              )}
              size={size}
              socialSlot={
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={publicationUrl(article.userUsername || "unknown")}
                    className="text-xs text-paper-muted underline-offset-2 hover:underline"
                  >
                    ~{article.userUsername}
                  </Link>
                  <IssueLikeControl
                    issueId={article.id}
                    publicationUsername={article.userUsername || "unknown"}
                    editionNumber={article.editionNumber}
                    likeCount={article.likeCount}
                    viewerHasLiked={article.viewerHasLiked}
                    isAuthenticated
                    returnTo="/feed"
                    compact
                  />
                </div>
              }
            />
          </div>
        );
      })}
    </EditorialGrid>
  );
}

function SubscriptionsTab({
  subscriptions,
}: {
  subscriptions: SubscriptionEntry[];
}) {
  if (subscriptions.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-body-editorial text-paper-muted">
          No email subscriptions yet.{" "}
          <Link
            href="/subscriptions"
            className="underline underline-offset-2 text-paper-ink"
          >
            Manage subscriptions
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {subscriptions.map((sub) => (
        <div
          key={sub.id}
          className="flex items-center justify-between border border-paper-border bg-white/60 px-5 py-4"
        >
          <div>
            <Link
              href={publicationUrl(sub.publicationUsername)}
              className="font-family-display text-xl leading-tight text-paper-ink hover:underline underline-offset-4"
            >
              {sub.publicationName}
            </Link>
            <p className="text-sm text-paper-muted mt-1">
              ~{sub.publicationUsername}
            </p>
          </div>
          <span className="text-meta-small px-2 py-1 border border-paper-border text-paper-muted">
            {sub.emailNotificationsEnabled ? "Email on" : "Email off"}
          </span>
        </div>
      ))}
      <div className="pt-2">
        <Link
          href="/subscriptions"
          className="text-meta text-paper-muted underline-offset-2"
        >
          Manage all subscriptions →
        </Link>
      </div>
    </div>
  );
}

function FollowsTab({ follows }: { follows: FollowEntry[] }) {
  if (follows.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-body-editorial text-paper-muted">
          You are not following anyone yet. Visit a publication to follow them.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {follows.map((follow) => (
        <div
          key={follow.userId}
          className="flex items-center gap-4 border border-paper-border bg-white/60 px-5 py-4"
        >
          {follow.image ? (
            <Image
              src={follow.image}
              alt={follow.name}
              width={40}
              height={40}
              className="w-10 h-10 object-cover border border-paper-border flex-shrink-0"
            />
          ) : (
            <div className="w-10 h-10 bg-paper-border flex items-center justify-center text-paper-muted text-sm flex-shrink-0">
              {(follow.name || follow.username).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link
              href={publicationUrl(follow.username)}
              className="font-family-display text-xl leading-tight text-paper-ink hover:underline underline-offset-4"
            >
              {follow.publicationName || follow.name}
            </Link>
            <p className="text-sm text-paper-muted mt-1">~{follow.username}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function LikesTab({ articles }: { articles: Article[] }) {
  const cardSizes = assignCardSizes(articles.length);

  if (articles.length === 0) {
    return (
      <div className="text-center py-16 px-6">
        <p className="text-body-editorial text-paper-muted">
          You have not liked any issues yet.
        </p>
      </div>
    );
  }

  return (
    <EditorialGrid>
      {articles.map((article, index) => {
        const size = cardSizes[index];
        const gridClasses = getCardGridClasses(size);
        return (
          <div key={article.id} className={`${gridClasses} group h-full`}>
            <ArticleCard
              article={article}
              href={issueUrl(
                article.userUsername || "unknown",
                article.editionNumber,
              )}
              size={size}
              socialSlot={
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href={publicationUrl(article.userUsername || "unknown")}
                    className="text-xs text-paper-muted underline-offset-2 hover:underline"
                  >
                    ~{article.userUsername}
                  </Link>
                  <IssueLikeControl
                    issueId={article.id}
                    publicationUsername={article.userUsername || "unknown"}
                    editionNumber={article.editionNumber}
                    likeCount={article.likeCount}
                    viewerHasLiked={article.viewerHasLiked}
                    isAuthenticated
                    returnTo="/feed"
                    compact
                  />
                </div>
              }
            />
          </div>
        );
      })}
    </EditorialGrid>
  );
}
