<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Kraken Repo Guidance

Start from the current codebase, not the original concept docs. The repo has evolved. Treat `.agents/GENESIS.md` as historical context and inspiration, not as the source of truth for implementation details.

# Session agent roster

These are the agents used in the current repo session and the role each one owns. If new agents are introduced later, extend this list instead of redefining overlapping ownership informally.

Direct user supervision is in effect for this phase. There is no separate supervisor agent.

Active agents:

- `Halley` - email design, email copy, template quality, and email-flow improvements.
- `Parfit` - logic, runtime behavior, implementation correctness, and QA-minded fixes.
- `Herschel` - README, docs, and developer-facing documentation quality.
- `James` - DevOps, automation, continuous integration, maintenance, scripts, and operational workflow improvements.

Retired or inactive for this phase:

- `Gibbs` - repo orientation and AGENTS guidance upkeep.
- `Lorentz` - supervisor and skill coordination.
- `Confucius` - design audit and design-fix planning.
- `Boole` - code quality, maintainability, structure, and non-behavioral refactors.
- `Socrates` - landing page lead, homepage conversion/design quality, and browser/MCP guidance for UI validation.

# Supervisor coordination rules

These rules apply to all active agents in this session.

- Treat the current `AGENTS.md` as the source of truth.
- If the current codebase conflicts with `AGENTS.md`, prefer rewriting the code to match `AGENTS.md` unless there is a strong technical reason to escalate first.
- Surface task updates frequently and compactly so the main agent can relay progress to the user often.
- If user input is needed, identify it quickly, phrase the question clearly, and send it up for relay instead of stalling.
- Maintain named-agent coordination. When reporting progress, include suggested next actions for the agent owning that area.
- If coordination rules change during the session, update this file so active agents can realign against the latest guidance.

# Verification cadence

Use the lightest check that still proves the slice is safe, then escalate to broader verification only when the change warrants it.

- `pnpm lint` is the default quick pass after any code change.
- `pnpm typecheck` is required after any TypeScript, route, server-action, or data-flow change.
- `pnpm test` is required after shared utility, validation, or integration-drift changes.
- `pnpm check` is the default handoff gate for most agent slices.
- `pnpm verify` is the broader local smoke test when route, config, runtime, or integration behavior could be affected.
- Browser verification is required for visible UI changes before the work is considered complete.
- `Halley` should run `pnpm email:test` after email template or delivery-flow changes.
- `Parfit` should rerun `pnpm check` and `pnpm test` after server, action, auth, database, or shared utility changes, and add targeted runtime verification when behavior changes.
- `Herschel` should spot-check links, code samples, and command snippets after documentation edits.
- `James` should keep validation scripts, CI workflow, and local maintenance commands aligned, and rerun `pnpm check`, `pnpm test`, or `pnpm verify` as the change scope widens.
- `Socrates` should browser-check the landing page and any homepage copy/layout changes.

Before making changes:
- Read the relevant Next.js docs under `node_modules/next/dist/docs/`.
- Inspect the existing implementation in `src/` and extend it instead of reintroducing outdated patterns from the genesis prompt.
- Do not assume generic middleware examples apply here. This repo uses `proxy.ts`, not `middleware.ts`.

Historical context:
@.agents/GENESIS.md

Design language:
@.agents/DESIGN.md

# Core stack

- Framework: Next.js 16 App Router
- Database: Neon serverless Postgres via Drizzle
- Authentication: Better Auth
- Styling: Tailwind CSS v4 + Base UI primitives
- Email: Resend
- Infrastructure: Vercel Domains API

# Source of truth by concern

- Routing and page entrypoints: `src/app/**`
- Root app shell and fonts: `src/app/layout.tsx`
- Hostname/domain rewriting: `proxy.ts`
- Auth server config: `auth.ts`
- Auth API handler: `src/app/api/auth/[...all]/route.ts`
- Auth schema tables: `auth-schema.ts`
- App schema tables: `src/db/schema.ts`
- Drizzle client: `src/lib/db.ts`
- Editorial queries: `src/lib/queries/updates.ts`
- Server actions: `src/actions/**`
- Global design tokens and shared visual language: `src/globals.css`
- Shared editorial UI: `src/components/editorial/**`
- Shared auth UI: `src/components/auth/**`

# Current route conventions

These are the implemented routes. Prefer matching them unless the task explicitly changes routing.

- `/` is the landing page. It is not a dedicated dashboard route. However it will redirect to `/feed` if logged in, if the user is logged in a wishes to see this page they can open `/home`
- `/feed` shows recent published issues in a twitter like feed.
- `/editorial` is the writer workspace and draft/publish surface.
- `/editorial/[id]` is where you edit an article
- `/settings` manages profile, publication title, and custom domains.
- `/subscriptions` manages reader subscriptions.
- `/auth/*` contains sign-in, sign-up, email auth, verify-email, onboarding, and auth state pages.
- Public profile URLs are `@` routes: `/@username`
- Public publication URLs are `~` routes: `/~username`
- Public issue URLs are `/~username/[editionNumber]`. You should be automatically following all the people you are subscribed too. The `/feed` is for the people you are following. This should be twitter like, showcase articles, subscriptions, follows, likes in tabs.
- `proxy.ts` should rewrite custom vercel domains to their publication. Setup cache for it. Use `@upstash/redis`

# Auth and onboarding conventions

- Better Auth is configured in `auth.ts` with email/password, Google OAuth, email OTP, magic links, username support, and 2FA-related plugins.
- The client entrypoint is `src/lib/auth-client.ts`.
- Session access goes through `src/hooks/session.ts`.
- Route protection is implemented with async server helpers in `src/hooks/authenticated.ts`, `src/hooks/onboarded.ts`, and `src/hooks/not-onboarded.ts`.
- Onboarding is currently represented by setting a Better Auth username. In the current code, `session.user.username` is what gates onboarding completion.
- Do not assume the older Clerk-based flow from `.agents/GENESIS.md` is still valid.

# Database conventions

- Drizzle schema is split between Better Auth tables in `auth-schema.ts` and product tables in `src/db/schema.ts`.
- `src/lib/db.ts` loads `.env.local` directly and creates a Neon HTTP Drizzle client. Be careful about environment assumptions in scripts and tests.
- Publications are one-per-user via a unique `publications.userId`.
- Issues support soft deletion with `deletedAt`; most issue queries filter `isNull(deletedAt)`.
- Published issue URLs currently depend on `issues.editionNumber` per publication.
- Subscription flows use `subscribers.token` for confirm/unsubscribe links and `issue_deliveries` to track email sends.

# UI and styling conventions

- Light mode only.
- Preserve the paper/editorial aesthetic already encoded in `src/globals.css`.
- Reuse existing tokens and utilities such as:
  - `bg-paper-base`, `text-paper-ink`, `text-paper-muted`, `border-paper-border`
  - `font-family-display`, `font-family-body`
  - `text-masthead`, `text-headline`, `text-body-editorial`, `text-meta`, `text-meta-small`
- Prefer existing shared components before creating new ones:
  - Editorial chrome in `src/components/editorial/**`
  - Auth layouts/forms in `src/components/auth/**`
- Base UI is used for primitives like buttons and inputs inside auth flows.
- USE BASE UI wherever possible, replace stuff with base ui if you can use base ui for it.
- Most layout/styling is still plain Tailwind classes. Match that style.
- Keep visuals flat and print-like: no rounded-corner-heavy, glassy, or dark-mode-oriented UI.
- Keep a newspaper aesthetic.

# Working style for this repo

- Use DRY principles, but not at the expense of readability or established patterns.
- Follow the current naming and file organization before introducing new abstractions.
- When editing auth or route behavior, inspect both the page/component layer and the helper/action layer it depends on.
- When editing public profile or issue rendering, check both:
  - `src/app/[handle]/page.tsx`
  - `src/app/[handle]/[editionNumber]/page.tsx`
  - Legacy redirect routes under `src/app/@/[username]/**` and `src/app/~/[username]/**`
- When editing editorial flows, inspect `src/components/editorial/EditorialWorkspace.tsx` and `src/actions/editorial-actions.ts` together.
- When editing subscriptions or email behavior, inspect both the server actions and the email templates in `src/emails/**`.

# Scripts and local workflow

- `pnpm dev` runs the app.
- `pnpm build` builds production output.
- `pnpm lint` runs `biome check`.
- `pnpm format` runs Biome formatting.
- `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`, `pnpm db:check` are the Drizzle workflows.
- `pnpm db:seed` runs `scripts/seed.ts`.
- `pnpm email:test` runs `scripts/email-test.ts`.

# Environment expectations

Common environment variables inferred from the current code:

- `DATABASE_URL`
- `BETTER_AUTH_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL` or equivalent sender config used by `src/lib/resend.ts`
- `VERCEL_API_TOKEN`
- `VERCEL_PROJECT_ID`
- `VERCEL_TEAM_ID`
- Redis ENV variables.

If a feature depends on external services, confirm how the repo currently handles missing configuration before changing behavior. Some paths intentionally no-op when email is not configured.

When repo-wide drift shows up, prefer fixing the underlying code or automation so the same issue cannot recur in later agent slices.

# Practical gotchas

- `proxy.ts` is critical for custom domain behavior. Avoid replacing it with generic middleware patterns.
- `src/lib/db.ts` calls `dotenv.config({ path: ".env.local" })`; changing runtime assumptions there has wide impact.
- The genesis doc still mentions Clerk, Loops, and older route shapes. The code does not.
- Public URLs use `@username`, but some internal settings UI still references `~username` as an implementation detail. Preserve behavior unless you are intentionally cleaning it up across the stack.
- The app currently mixes server components, client components, and server actions. Respect existing boundaries before moving logic around.

# External references

- Base UI reference: https://base-ui.com/llms.txt

# Product summary

Kraken is a personal publishing platform for staying connected with friends through regular life updates. Share daily notes, weekly letters, or monthly check-ins on your own cadence. Your friends receive them predictably via email or a calm feed, without algorithms deciding who sees what.

The platform maintains an editorial aesthetic (publications, mastheads, issues) as a design choice, but the tone is personal and intimate—like writing letters to friends rather than performing for an audience. It's social media made calmer, more predictable, and more focused on staying caught up with people you care about than competing for attention in an algorithmic feed.

## Cursor Cloud specific instructions

### Environment variables

A `.env.local` file is required at the workspace root. The following variables must be set for the app to start:

- `DATABASE_URL` — Neon serverless Postgres connection string (app crashes without it).
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — `getEnv()` in `auth.ts` throws at module load if either is missing. Set to placeholder values if Google OAuth is not needed.
- `BETTER_AUTH_SECRET` — required by Better Auth for session signing.
- `BETTER_AUTH_URL` — defaults to `http://localhost:3000` if unset.

Resend, Vercel Domains, and Redis env vars are optional; those code paths no-op gracefully when unconfigured.

### Running services

- `pnpm dev` starts the Next.js 16 dev server on port 3000 (Turbopack).
- The landing page (`/`), sign-in (`/auth/sign-in`), and sign-up (`/auth/sign-up`) render without a live database because `getSession()` is wrapped in a try/catch on the landing page. Authenticated routes will fail without a real `DATABASE_URL`.
- There is no Docker, Redis, or other auxiliary service to start locally. The app is fully serverless.

### Verification commands

Standard commands are documented in the `Scripts and local workflow` section above. Key quick-reference:

- `pnpm lint` — Biome static analysis (fast, no env vars needed).
- `pnpm typecheck` — TypeScript check (no env vars needed).
- `pnpm test` — Node test runner for utility tests (no env vars needed).
- `pnpm check` — lint + typecheck combined gate.
- `pnpm build` — production build (needs `.env.local` with at least `DATABASE_URL` placeholder).
