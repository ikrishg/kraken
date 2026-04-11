import Link from "next/link";
import { Masthead } from "@/components/editorial";
import { DateDisplay } from "@/components/editorial/DateDisplay";
import { IssueLikeControl } from "@/components/editorial/IssueLikeControl";
import { SubscriptionBox } from "@/components/editorial/SubscriptionBox";
import { MarkdownRender } from "@/lib/utils/markdown";
import { issueUrl, publicationUrl } from "@/lib/utils/routes";

interface SessionLike {
  user?: {
    name?: string | null;
    image?: string | null;
    username?: string | null;
    email?: string | null;
  } | null;
}

interface IssueViewData {
  id: string;
  editionNumber: number;
  headline: string;
  content: string;
  publishedAt: Date | string;
  readTime: number;
  userName?: string | null;
  userUsername?: string | null;
  likeCount: number;
  viewerHasLiked: boolean;
}

interface PublicationIssueViewProps {
  username: string;
  publicationTitle: string;
  issue: IssueViewData;
  session: SessionLike | null;
  isOwnPublication: boolean;
  isSubscribed: boolean;
  isFollowing: boolean;
  isAuthenticated: boolean;
  subscribe?: string;
}

export function PublicationIssueView({
  username,
  publicationTitle,
  issue,
  session,
  isOwnPublication,
  isSubscribed,
  isFollowing,
  isAuthenticated,
  subscribe,
}: PublicationIssueViewProps) {
  const publishedDate =
    issue.publishedAt instanceof Date
      ? issue.publishedAt
      : new Date(issue.publishedAt);

  return (
    <main className="min-h-screen bg-paper-base">
      <div className="mx-auto max-w-[1400px] px-6 md:px-12">
        <div className="py-8">
          <Masthead
            userName={session?.user?.name}
            userImage={session?.user?.image}
            userUsername={session?.user?.username}
            showAvatar={!!session}
            title={publicationTitle}
            linkTo={publicationUrl(username)}
            date={publishedDate}
            className="mb-8"
          />
        </div>

        <article className="py-8 lg:py-12">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
            <div>
              <div className="max-w-4xl border-b border-paper-border pb-8">
                <p className="text-meta text-paper-muted">
                  Edition from the publication desk
                </p>
                <h1 className="mt-4 text-headline leading-tight text-paper-ink">
                  {issue.headline}
                </h1>

                <div className="mt-5 flex flex-wrap items-center gap-4 text-sm text-paper-muted">
                  {issue.userUsername && (
                    <Link
                      href={publicationUrl(issue.userUsername)}
                      className="text-paper-ink underline-offset-4 hover:underline"
                    >
                      by {issue.userName || issue.userUsername}
                    </Link>
                  )}
                  <span>{issue.readTime} min read</span>
                  <DateDisplay
                    date={publishedDate}
                    className="text-paper-muted"
                  />
                </div>

                <div className="mt-5">
                  <IssueLikeControl
                    issueId={issue.id}
                    publicationUsername={username}
                    editionNumber={issue.editionNumber}
                    likeCount={issue.likeCount}
                    viewerHasLiked={issue.viewerHasLiked}
                    isAuthenticated={isAuthenticated}
                    returnTo={issueUrl(username, issue.editionNumber)}
                  />
                </div>
              </div>

              <div className="max-w-4xl pt-8">
                <MarkdownRender className="prose-lg max-w-none text-body-editorial leading-relaxed text-paper-ink">
                  {issue.content}
                </MarkdownRender>
              </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-8">
              <div className="border border-paper-border bg-white/60 p-5">
                <p className="text-sm text-paper-muted">Publication</p>
                <p className="mt-3 font-family-display text-2xl leading-tight text-paper-ink">
                  {publicationTitle}
                </p>
                <p className="mt-2 text-body-editorial text-paper-muted">
                  Follow the publication, return to the archive, or subscribe to
                  receive the next edition in your inbox.
                </p>
              </div>

              <SubscriptionBox
                publicationUsername={username}
                publicationName={publicationTitle}
                isAuthenticated={!!session}
                isOwnPublication={isOwnPublication}
                isSubscribed={isSubscribed}
                isFollowing={isFollowing}
                returnTo={publicationUrl(username)}
                status={subscribe}
              />
            </aside>
          </div>
        </article>
      </div>
    </main>
  );
}
