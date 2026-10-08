# Kraken

**Kraken** is a personal publishing platform for staying connected with friends through regular life updates. Share daily notes, weekly letters, or monthly check-ins—your friends receive them predictably via email or feed, without algorithms deciding who sees what. It's social media made calmer, more personal, and more like staying in touch than performing for an audience.

## Stack

The application code in this repository uses:

- **Next.js 16** (App Router)
- **Better Auth** for authentication (email/password, Google OAuth, magic links, email OTP, username onboarding, and 2FA-related plugins)
- **Neon** serverless Postgres with **Drizzle ORM**
- **Tailwind CSS v4** with **Base UI** primitives
- **Resend** with **React Email** templates in `src/emails/**` for transactional and issue email
- **Vercel Domains API** (via `src/lib/vercel-domains.ts`) for custom domain attach and verification

This is not the older Clerk + Loops stack described in `.agents/GENESIS.md`. Auth and email in production paths go through Better Auth and Resend.

## Getting Started

```bash
pnpm install
# Create .env.local with the variables listed below
pnpm dev
```

Open `http://localhost:3000` to view the app.

## Local Workflow

- `pnpm dev` runs the app.
- `pnpm build` creates a production build.
- `pnpm lint` runs Biome checks.
- `pnpm typecheck` runs TypeScript with no emit.
- `pnpm test` runs Node test files for shared utilities.
- `pnpm check` runs lint and typecheck.
- `pnpm verify` runs check, test, and build.
- `pnpm format` formats the codebase with Biome.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, and `pnpm db:check` manage Drizzle schema workflows.
- `pnpm db:seed` seeds sample publications and issues from `scripts/seed.ts`; it expects at least one real user to already exist.
- `pnpm email:test` sends test emails from `scripts/email-test.ts` and requires `TEST_EMAIL_TO`.

## Main Routes

- `/` is the landing page; signed-in users are redirected to `/feed` (use `/home` to view the landing page while signed in).
- `/feed` is the reader feed of recent published issues.
- `/editorial` is the writer workspace. Article editing currently happens in this UI; the `/editorial/[id]` route described in `AGENTS.md` is not built yet.
- `/settings` manages profile, publication title, and custom domains.
- `/subscriptions` manages reader subscriptions.
- `/auth/*` covers sign-in, sign-up, email auth, verify-email, onboarding, and auth state pages.
- `/@username` is the profile-style public view.
- `/~username` is the publication-style view with subscription controls.
- `/~username/[editionNumber]` is the publication-style issue view.

For a compact route map and notes on the public/domain routing split, see [docs/routes.md](docs/routes.md).

## Architecture Notes

- Root layout and global fonts live in `src/app/layout.tsx`.
- App routing lives in `src/app/**`.
- Hostname and custom-domain rewriting live in `proxy.ts` (not `middleware.ts`).
- Better Auth is configured in `auth.ts`, with the API handler in `src/app/api/auth/[...all]/route.ts`.
- Drizzle schema is split between `auth-schema.ts` (Better Auth tables) and `src/db/schema.ts` (product tables).
- The Drizzle client lives in `src/lib/db.ts` and loads `.env.local` directly.
- Server actions live in `src/actions/**`.
- Editorial UI lives in `src/components/editorial/**`.
- Auth UI lives in `src/components/auth/**`.
- Email templates live in `src/emails/**`.
- Custom domain resolution uses `proxy.ts` and `src/app/api/internal/domain-lookup/route.ts`.

## Environment Variables

The code currently expects some combination of the following values. `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are both required to initialize auth (including email/password sign-in), because `auth.ts` reads them at module load; use placeholder values if you don't need Google OAuth.

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_APP_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`
- `TEST_EMAIL_TO`

Email sending is skipped when `RESEND_API_KEY` is missing. Custom-domain actions need all three `VERCEL_*` values and fail without them. Check the implementation before changing those behaviors.

## Contributing Notes

- Read `AGENTS.md` first. It is the repo guidance source of truth.
- The codebase is intentionally light-mode only and leans into a paper/editorial aesthetic.
- When changing auth, routing, subscriptions, or editor behavior, inspect both the page layer and the matching server-action/helper layer.
- When changing public pages or issue rendering, check the `@` and `~` route families together.
- When changing the landing page, auth flows, or other visible surfaces, browser verification is worth doing before merging.

## Product Summary

Kraken is built for recurring writing. It is meant for people who want a calmer way to publish updates, keep an archive, and let readers follow by email or on the web.
