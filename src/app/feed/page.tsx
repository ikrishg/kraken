import { Masthead } from "@/components/editorial";
import { FeedTabs } from "@/components/feed/FeedTabs";
import { useOnboarded } from "@/hooks/onboarded";
import {
  getFeedUpdatesForUser,
  getFollowsForUser,
  getLikedIssuesForUser,
  getSubscriptionsForUser,
} from "@/lib/queries/updates";

export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const session = await useOnboarded();
  const [articles, follows, subscriptions, likedArticles] = await Promise.all([
    getFeedUpdatesForUser(session.user.id, 12),
    getFollowsForUser(session.user.id),
    getSubscriptionsForUser(session.user.id, session.user.email),
    getLikedIssuesForUser(session.user.id, 12),
  ]);

  return (
    <main className="min-h-screen bg-paper-base">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="py-8">
          <Masthead
            userName={session.user.name}
            userImage={session.user.image}
            userUsername={session.user.username}
            showAvatar
            title="FEED"
            linkTo="/feed"
            className="mb-8"
          />
        </div>

        <FeedTabs
          articles={articles}
          follows={follows}
          subscriptions={subscriptions}
          likedArticles={likedArticles}
        />
      </div>
    </main>
  );
}
