import Link from "next/link";
import { Button } from "@/components/ui/button";
import { publicationUrl } from "@/lib/utils/routes";

type SessionLike = {
  user?: {
    username?: string | null;
  } | null;
} | null;

interface KrakenLandingPageProps {
  session?: SessionLike;
}

export function KrakenLandingPage({ session = null }: KrakenLandingPageProps) {
  const isSignedIn = Boolean(session);
  const publicationHref = session?.user?.username
    ? publicationUrl(session.user.username)
    : "/auth/sign-up";

  return (
    <main className="min-h-screen bg-paper-base">
      {/* Masthead Navigation */}
      <nav className="border-b border-paper-muted">
        <div className="container mx-auto px-8 py-6 md:px-12 lg:px-16">
          <div className="flex justify-between gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h1 className="font-family-display font-semibold text-4xl text-paper-ink">
              KRAKEN
            </h1>
            <Link
              href={isSignedIn ? "/editorial" : "/auth/sign-in"}
              className="hover:text-paper-accent transition-colors"
            >
              <Button variant="primary">
                {isSignedIn ? "Dashboard" : "Sign In"}
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="border-b border-paper-border">
        <div className="container mx-auto px-8 py-6 md:px-12 lg:px-16">
          <div className="max-w-content space-y-12">
            <div className="space-y-8">
              <h2 className="font-family-display text-4xl sm:text-6xl tracking-tight text-paper-ink md:text-8xl lg:text-hero">
                Stay caught up with your friends' lives without the social media
                chaos.
              </h2>

              <p className="max-w-compact leading-relaxed text-paper-muted md:text-lead-lg md:leading-loose">
                Kraken is where your friends share what's really happening in
                their lives: weekly letters, monthly check-ins, or whenever
                something worth sharing comes up. No endless scroll, no
                algorithm deciding who you see, just the people you choose to
                follow.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <Link
                href={isSignedIn ? "/editorial" : "/auth/sign-up"}
                className="inline-flex items-center justify-center bg-paper-ink px-8 py-4 text-sm tracking-wider text-paper-base transition-all hover:bg-paper-accent"
              >
                {isSignedIn
                  ? "WRITE YOUR NEXT UPDATE"
                  : "START SHARING WITH FRIENDS"}
              </Link>
              <Link
                href={isSignedIn ? publicationHref : "/feed"}
                className="inline-flex items-center justify-center px-8 py-4 text-sm tracking-wider text-paper-ink underline decoration-1 underline-offset-4 transition-colors hover:text-paper-accent"
              >
                {isSignedIn ? "YOUR PUBLICATION" : "SEE HOW IT WORKS"}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Three-Column Features */}
      <section className="border-b border-paper-border">
        <div className="container mx-auto px-8 py-20 md:px-12 md:py-24 lg:px-16">
          <div className="grid gap-16 md:grid-cols-3 md:gap-12">
            <div className="space-y-4">
              <p className="text-meta text-paper-muted tracking-widest">
                CADENCE
              </p>
              <h3 className="font-family-display text-2xl leading-tight tracking-normal text-paper-ink">
                Your rhythm, not theirs.
              </h3>
              <p className="text-body-lg leading-snug text-paper-ink">
                Share daily notes, weekly letters, or monthly updates. There's
                no algorithm pushing you to post constantly—just write when you
                have something worth sharing.
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-meta text-paper-muted tracking-widest">
                DELIVERY
              </p>
              <h3 className="font-family-display text-2xl leading-tight tracking-normal text-paper-ink">
                Inbox, feed, or publication page.
              </h3>
              <p className="text-body-lg leading-snug text-paper-ink">
                Your updates reach friends through email, show up in their feed,
                and live on your personal publication page. They choose how they
                want to stay connected.
              </p>
            </div>
            <div className="space-y-4">
              <p className="text-meta text-paper-muted tracking-widest">
                IDENTITY
              </p>
              <h3 className="font-family-display text-2xl leading-tight tracking-normal text-paper-ink">
                Start with ~username, grow into your own space.
              </h3>
              <p className="text-body-lg leading-snug text-paper-ink">
                Begin with a simple profile, then add a custom domain if your
                updates turn into something bigger. Your publication grows with
                you.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="border-b border-paper-border">
        <div className="container mx-auto px-8 py-20 md:px-12 md:py-24 lg:px-16">
          <div className="space-y-16">
            <div className="mx-auto max-w-narrow space-y-6 text-center">
              <p className="text-meta text-paper-muted tracking-widest">
                HOW IT WORKS
              </p>
              <h2 className="font-family-display text-4xl leading-display tracking-snug text-paper-ink md:text-5xl">
                How staying connected actually works on Kraken.
              </h2>
              <p className="text-xl leading-relaxed text-paper-muted">
                No ads, no algorithm, no endless scroll. Just a calmer way to
                share life updates with people who want to hear from you.
              </p>
            </div>

            <div className="mx-auto max-w-tight space-y-12">
              <div className="space-y-4 border-t-2 border-paper-ink pt-8">
                <p className="text-meta text-paper-muted tracking-widest">
                  STEP 01
                </p>
                <h3 className="font-family-display text-3xl leading-tight tracking-snug text-paper-ink">
                  Write updates when they matter.
                </h3>
                <p className="text-lg leading-loose text-paper-muted">
                  Draft your update, add a title, publish when it's ready. Could
                  be a quick life check-in or a longer story about what you've
                  been up to—whatever feels right.
                </p>
              </div>

              <div className="space-y-4 border-t border-paper-border pt-8">
                <p className="text-meta text-paper-muted tracking-widest">
                  STEP 02
                </p>
                <h3 className="font-family-display text-3xl leading-tight tracking-snug text-paper-ink">
                  Your friends get them predictably.
                </h3>
                <p className="text-lg leading-loose text-paper-muted">
                  People subscribe to your updates by username. They know when
                  to expect your check-ins, and they receive them in their inbox
                  or feed—no algorithm hiding what you share.
                </p>
              </div>

              <div className="space-y-4 border-t border-paper-border pt-8">
                <p className="text-meta text-paper-muted tracking-widest">
                  STEP 03
                </p>
                <h3 className="font-family-display text-3xl leading-tight tracking-snug text-paper-ink">
                  Build a record of your life over time.
                </h3>
                <p className="text-lg leading-loose text-paper-muted">
                  Each update adds to your archive. Over time, it becomes a
                  chronological record of what you've been up to—something you
                  and your friends can look back on.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For */}
      <section className="border-b border-paper-border">
        <div className="container mx-auto px-8 py-20 md:px-12 md:py-24 lg:px-16">
          <div className="mx-auto max-w-content space-y-12">
            <div className="space-y-6">
              <p className="text-meta text-paper-muted tracking-widest">
                WHO IT'S FOR
              </p>
              <h2 className="font-family-display text-3xl leading-display tracking-snug text-paper-ink md:text-4xl lg:text-5xl">
                Built for people who want to stay close without staying glued to
                their phones.
              </h2>
            </div>

            <div className="space-y-6 pl-8 text-lg leading-loose text-paper-ink md:pl-12">
              <p className="relative before:absolute before:-left-8 before:content-['—'] before:text-paper-muted md:before:-left-12">
                You have more to share than a social post can hold, but you're
                not trying to be a professional writer
              </p>
              <p className="relative before:absolute before:-left-8 before:content-['—'] before:text-paper-muted md:before:-left-12">
                You want to keep friends updated without posting every single
                day
              </p>
              <p className="relative before:absolute before:-left-8 before:content-['—'] before:text-paper-muted md:before:-left-12">
                You miss hearing real updates from friends instead of seeing
                what an algorithm thinks you'll engage with
              </p>
              <p className="relative before:absolute before:-left-8 before:content-['—'] before:text-paper-muted md:before:-left-12">
                You'd rather write occasional check-ins than compete for
                attention in someone's crowded feed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Block */}
      <section className="border-b-2 border-paper-ink bg-paper-ink">
        <div className="container mx-auto px-8 py-20 md:px-12 md:py-24 lg:px-16">
          <div className="mx-auto max-w-tight space-y-8">
            <p className="text-meta tracking-widest text-paper-base/60">
              WHY IT LANDS
            </p>
            <h2 className="font-family-display text-3xl leading-display tracking-snug text-paper-base md:text-4xl lg:text-5xl">
              Staying connected shouldn't mean drowning in noise.
            </h2>
            <p className="text-xl leading-loose text-paper-base/85">
              Kraken exists for the updates your friends keep meaning to send:
              the life changes, the small victories, the things worth sharing
              but too substantial for a status update. Give them a place that
              feels more like writing letters than performing for an audience.
            </p>
            <div className="space-y-3 pt-6 text-base text-paper-base/75">
              <p>→ Your friends get updates, not content.</p>
              <p>→ You get to share life, not curate a persona.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section>
        <div className="container mx-auto px-8 py-24 md:px-12 md:py-32 lg:px-16 lg:py-40">
          <div className="mx-auto max-w-4xl space-y-12 text-center">
            <div className="space-y-6">
              <p className="text-meta text-paper-muted tracking-widest">
                START SHARING
              </p>
              <h2 className="font-family-display text-3xl leading-hero tracking-tight text-paper-ink md:text-4xl lg:text-hero">
                Share what's actually happening in your life.
              </h2>
              <p className="mx-auto max-w-prose text-xl leading-loose text-paper-muted">
                Kraken is for the kind of updates your friends actually want to
                read—the ones they'd ask about if you were catching up over
                coffee. Write when you have something to say, and let the people
                who care about you stay caught up.
              </p>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center">
              <Link
                href={isSignedIn ? "/editorial" : "/auth/sign-up"}
                className="inline-flex items-center justify-center bg-paper-ink px-8 py-4 text-sm tracking-wider text-paper-base transition-all hover:bg-paper-accent"
              >
                {isSignedIn ? "WRITE YOUR UPDATE" : "START YOUR PUBLICATION"}
              </Link>
              <Link
                href={isSignedIn ? publicationHref : "/feed"}
                className="inline-flex items-center justify-center px-8 py-4 text-sm tracking-wider text-paper-ink underline decoration-1 underline-offset-4 transition-colors hover:text-paper-accent"
              >
                {isSignedIn ? "YOUR PUBLICATION" : "BROWSE FRIEND UPDATES"}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
