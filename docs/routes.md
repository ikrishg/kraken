# Route Map

This page is a quick reference for the route structure in the current codebase.

## Core App Routes

- `/` — landing page. Signed-in users are redirected to `/feed`.
- `/home` — the same landing experience for signed-in users who want to return to the marketing page.
- `/feed` — reader feed with tabs: Articles (from followed writers), Subscriptions, Follows, and Likes.
- `/editorial` — writer workspace (no issue pre-selected).
- `/editorial/[id]` — writer workspace focused on a specific issue by database id.
- `/settings` — manages the profile name, publication title, and custom domains.
- `/subscriptions` — manages reader subscriptions and inbox preferences.

## Auth Routes

- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/email`
- `/auth/verify-email`
- `/auth/onboarding`
- `/auth/unauthenticated`
- `/auth/unauthorized`

## Public Publication Routes

Both `@` and `~` handles are routed through the shared `src/app/[handle]/**` segment.

- `/@username` — redirects to `/~username` (profile-style alias).
- `/~username` — publication home with subscription controls (canonical).
- `/~username/[editionNumber]` — individual published issue (canonical).

Use the helpers in `src/lib/utils/routes.ts` (`publicationUrl`, `issueUrl`, `profileUrl`, `editorialUrl`) whenever you build links or call `revalidatePath` with these paths. Never hard-code template literals like `` `/~${username}` `` outside that module.

## Custom Domains

Custom domains are resolved in `proxy.ts`, which:

1. Checks an Upstash Redis cache (key `domain:{hostname}`, TTL 5 minutes) first.
2. Falls back to `src/app/api/internal/domain-lookup/route.ts` on a cache miss.
3. Writes the result back to Redis (including an empty string for unknown domains to short-circuit repeat misses).

Cache entries are invalidated by `invalidateDomainCache()` in `src/actions/settings-actions.ts` whenever a custom domain is added, verified, or removed.

## Notes for Contributors

- Prefer updating both the page component and its matching helper/action when changing route behavior.
- When adding a new public route, add a helper to `src/lib/utils/routes.ts` and update this file and `README.md` together.
- `generateMetadata` is exported from both `[handle]/page.tsx` and `[handle]/[editionNumber]/page.tsx` and derives title, description, canonical URL, and OpenGraph tags from the database. Keep these in sync with the page content.
