---
name: linky-codebase
description: Product language, brand voice, architecture, and Next.js 16 / Clerk / Stripe / Neon conventions for contributing to the Linky repo. Use when modifying any file in this codebase, writing user-facing copy, adding API routes, authoring database migrations, writing tests, or onboarding a new contributor. Covers the "Linky" singular vs "launch bundles" plural rule, the required `src/proxy.ts` location, the auth subject model, ownership enforcement, the repository + migration pattern, and the claim flow.
---

# Linky Codebase Conventions

This skill encodes how we build **inside** the Linky repo. For creating a Linky via the public API, see the sibling `linky` skill (different scope).

Always read `AGENTS.md` at the repo root before writing Next.js code — it points at the in-repo Next docs that must be consulted because Next.js 16 has breaking changes.

---

## Product language (brand rules)

These are **strict**. They appear in user-facing surfaces (UI copy, READMEs, blog posts, error messages, docs).

| Term | Use for | Never say |
|---|---|---|
| **Linky** (singular, capitalized) | The brand. The short URL. The verb: "create a Linky", "send a Linky". | — |
| **launch bundle(s)** | The plural in prose. "Your launch bundles", "team-owned bundles", "no bundles yet". | "Linkies" (my internal plural — do not leak into UI/docs) |
| **links** | The plural noun when referring to URL paths or the short URLs themselves. `/api/links`, `/dashboard/links/[slug]`. | "linkies" in URLs |
| **launcher page** | `/l/[slug]` — where the Open All button lives. | "Linky page", "the landing" |
| **claim URL / claim flow** | The agent-initiated handoff. `/claim/[token]`. | "activation link", "bind URL" |
| **subject** (internal) | The auth actor: `org`, `user`, or `anonymous`. Use in code + dev comments. | "account" (ambiguous with Clerk account) |

**Internal identifiers keep "linkies"** (table name, repo file, function names — `linkies`, `linkies-repository.ts`, `listLinkiesForSubject`, `maxLinkies`). Do **not** rename them — they are not on the public contract and churning them just adds noise.

---

## Brand voice

Terminal aesthetic. Stark, confident, agent-first. No fluff.

- **Typography**: mono stack (`--font-linky-mono`, IBM Plex Mono) for body, `Bricolage Grotesque` (`.display-title`) for headlines.
- **Color**: `#ffffff` background, `#111111` foreground, thin `#d9d9d9` borders. No gradients. No rounded corners beyond `0` (see `.terminal-action`, `.terminal-secondary`, etc.).
- **Layout primitives**: `.site-shell`, `.site-hero`, `.site-section`, `.site-divider-list`, `.site-inline-callout`, `.terminal-card`, `.terminal-input`, `.terminal-action`. Reach for existing classes before adding new ones.
- **Voice**: "Create a Linky", not "Get started now!". "Bundle many URLs", not "Unlock powerful workflows". Imperative, concrete, low marketing-energy.
- **Agent-first framing**: copy should respect that the reader might be an LLM or a CLI operator, not a mouse-driven consumer.

---

## Stack at a glance

- **Runtime**: Next.js 16.2.3 (App Router), React 19.2.4, Node.js 18.18+
- **Auth**: Clerk (`@clerk/nextjs` v7). Source of truth lives in Clerk; we mirror users + orgs + memberships into Neon via webhooks.
- **Billing**: Stripe direct. No Clerk Billing. Scaffolded only in Sprint 1 — Customers are minted per user and per org on `user.created` / `organization.created`, no paid plans live yet.
- **Database**: Neon Postgres via raw `pg` (`Pool`). **No ORM.** Repositories own the SQL.
- **Webhooks**: `svix` verifies Clerk, Stripe verifies itself. Both live at `/api/webhooks/{provider}`.
- **Tests**: vitest, Node env, `server-only` stubbed. `npm run check` runs lint + typecheck + tests.

---

## Next.js 16 gotchas

These WILL bite you if you write Next.js from memory. The canonical docs in `node_modules/next/dist/docs/` are the source of truth.

1. **`middleware.ts` is deprecated and renamed to `proxy.ts`** in Next.js 16. The file MUST live at `src/proxy.ts` (next to `app/`), not at the repo root — a root-level `proxy.ts` is silently ignored, and Clerk surfaces: *"clerkMiddleware() was not run, your middleware or proxy file might be misplaced."* If you ever see that error, check the file location first.
2. **Dynamic route `params` is a `Promise`** — always `await` it in route handlers and pages:
   ```ts
   type RouteContext = { params: Promise<{ slug: string }> };
   export async function GET(_req: NextRequest, ctx: RouteContext) {
     const { slug } = await ctx.params;
   }
   ```
3. **No `runtime` config in `proxy.ts`** — Proxy defaults to Node.js runtime in Next 16 and setting `runtime` throws at build time.
4. **React 19 compiler is strict about purity** — `Date.now()`, `Math.random()`, and similar impure calls inside a Server Component render function will fail lint. Compute these in a server-only helper (outside React's call path) and pass the result as a prop. See `lookupClaimToken` → `expiresInDays` for the pattern.
5. **Server Components over client-only fetches** — prefer calling the repository directly from Server Components for first paint; use API routes when the CLI/SDK/UI all need the same behavior.

---

## Auth subject model

Every request resolves to one of three subjects (`src/lib/server/auth.ts`):

```ts
type AuthSubject =
  | { type: "anonymous" }
  | { type: "user"; userId: string }
  | { type: "org"; orgId: string; userId: string; role: string | null };
```

- **`getAuthSubject()`** — safe everywhere, returns `anonymous` when no Clerk session.
- **`requireAuthSubject()`** — throws `AuthRequiredError` if anonymous; use in owner-only routes.
- **`canEditLinky(subject, ownership)` / `requireCanEditLinky(...)`** — the one place ownership rules live. Test coverage is exhaustive in `src/lib/server/auth.test.ts`. Add new edge cases there, never inline.

### Ownership rules (strict)

- **Anonymous Linkies are immutable.** Both owner columns NULL → no edit, no delete, ever. Preserves the trust model: a shared public Linky will never change under its consumers.
- **Org context wins over user context at create time.** If the caller has an active Clerk org, ownership goes to the org (team-owned). Only falls back to user when no org is active.
- **Org-owned Linkies are editable by any member** of that org (role-based restrictions are a future sprint). A user must have the org as their **active** Clerk context to edit — ambient membership is intentionally not enough.
- **The only way to claim an anonymous Linky** is the `claim_tokens` flow via `/claim/[token]`. Do not add backdoors.

---

## Repository pattern

Data access lives in `src/lib/server/*-repository.ts`. Rules:

- Import `"server-only"` at the top. Never call from client components.
- Use `getPgPool()` from `src/lib/server/postgres.ts` (singleton, SSL-aware).
- Write raw SQL. No ORM. Parameters via `$1, $2, ...` — always parameterized, never string-interpolated.
- Normalize DB rows through a `mapDbRow` function so the rest of the app sees domain types, not Postgres shapes.
- **Mutations that touch multiple rows run in a transaction** with `FOR UPDATE` row locks. See `patchLinkyRecord` and `consumeClaimToken` for the pattern.
- Return tagged result unions for expected failure modes (`{ status: "expired" }`, `{ status: "already-owned" }`, etc.). Throw only for unexpected errors — never for control flow.

---

## Errors

Three typed errors that API routes check for explicitly:

| Error | Where it lives | Used for |
|---|---|---|
| `LinkyError` | `src/lib/linky/errors.ts` | Domain + HTTP errors; carries `code`, `statusCode`, `details`. |
| `AuthRequiredError` | `src/lib/server/auth.ts` | 401 — caller must sign in. |
| `ForbiddenError` | `src/lib/server/auth.ts` | 403 — caller is signed in but cannot act. |

Route handlers catch these explicitly and translate to JSON responses. Unexpected errors fall through to `INTERNAL_ERROR` with a generic public message (never leak a raw Postgres error to the wire).

---

## Migrations + schema

- Fresh installs run `npm run db:schema` (applies `db/schema.sql`).
- Upgrades run `npm run db:migrate` (applies every `db/migrations/*.sql` in order, idempotently).
- **Every migration must be idempotent.** Use `CREATE TABLE IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`. For constraints and other constructs without `IF NOT EXISTS`, use a `DO $$ ... END $$` block that checks `pg_constraint` first. See `db/migrations/002_auth_ownership.sql`.
- **Update `db/schema.sql` in the same commit** so fresh installs converge to the same end state as the migration path.
- **Never edit a migration file after it lands on `main`.** Write a follow-up migration. This preserves the property that anyone who applied the broken version first can still converge.
- See `db/migrations/README.md` for the full authoring guide.

---

## Tests

- vitest unit tests live next to the source they cover: `foo.ts` → `foo.test.ts`.
- `server-only` is aliased to an empty stub in `vitest.config.ts` so server modules can be exercised without booting Next.js.
- What to test: pure logic (ownership matrix, schema parsing, fingerprint hashing, entitlements). Do not stand up a real Postgres in unit tests; leave integration testing for a future harness.
- `npm run check` = lint + typecheck + tests. Must be green before committing.

---

## Commit hygiene

- Work on branches named for the sprint or feature (`sprint-1-foundation`, not `mh-stuff`).
- Commit messages explain **why** as much as **what**. Example subjects:
  - `feat: Clerk + Stripe foundation and owned-Linky API (Sprint 1 chunk A)`
  - `fix: move proxy.ts into src/ so Next.js 16 loads it`
  - `refactor: normalize "Linkies" → /links URLs + "launch bundles" copy`
- Use a HEREDOC for multi-line messages. Do NOT use `cat <<'EOF'` with double-quoted content inside — shell escaping will mangle `"` into `\"`. Use `cat <<EOF` (unquoted) and escape the special chars you need, or avoid quotes entirely in the message.
- Never commit `.env*` files. `.env.example` is currently gitignored in this repo on purpose.

---

## Server-injected metadata

Some request fields are set by the server, not the caller, and live under
the reserved `metadata._linky` namespace on each Linky so they don't
collide with caller-supplied keys:

- **`metadata._linky.client`** — value of the optional `Linky-Client`
  request header. Convention: `<tool>/<version>` (e.g. `cursor/skill-v1`).
  Malformed values are silently dropped by `parseClientAttributionHeader`.
  Any caller attempt to set `metadata._linky` directly is stripped at the
  route layer; attribution is always server-truthed.

When adding new server-injected metadata, put it under `_linky.*` and
never trust a caller-provided `_linky` object.

## Claim-flow contract

Anonymous create responses return **all three** of:
- `claimToken` — the raw secret, returned once, non-recoverable.
- `claimUrl` — a convenience URL that embeds the token.
- `warning` — a human-readable "save this now" string the CLI / SDK can
  surface verbatim.

When you change the claim flow (expiry, token format, email binding,
consume semantics), keep the one-shot guarantee intact: a token is
handed back exactly once, cannot be re-issued for the same anonymous
Linky, and cannot be recovered via any other endpoint.

## Don't do

- **Do not put `middleware.ts` at the repo root.** The file is `src/proxy.ts` in Next.js 16. Nowhere else.
- **Do not send `alias` in `POST /api/links`.** Custom aliases are rejected server-side in Sprint 1 — will be re-introduced later with domain-ownership controls.
- **Do not use `forceRedirectUrl` on Clerk `<SignIn />` / `<SignUp />`.** It breaks the claim flow's `redirect_url` round-trip. Use `fallbackRedirectUrl`.
- **Do not call `Date.now()` / `Math.random()` in React render** (Server or Client). Compute in a server-only helper and pass down.
- **Do not introduce an ORM.** Raw `pg` is deliberate. Query shapes are explicit for a reason.
- **Do not refactor internal `linkies` names for cosmetic consistency with the UI.** The table name, repo file, and function names stay.
- **Do not extend `maxUrlsPerLinky`, `maxLinkies`, or any entitlement blindly.** Those gate agent abuse. Change them only with a plan.
- **Do not add a new public endpoint without listing it in `README.md` and updating `src/proxy.ts` matchers** if it needs auth.
- **Do not treat `metadata._linky` as caller-writable.** Server-owned. Strip, don't merge.
- **Do not add an endpoint that re-issues a claim token for an existing anonymous Linky.** Breaks the one-shot contract. If you need a recovery flow, design it against `creator_fingerprint` with explicit product review.

---

## Quick orientation

| You want to | Start here |
|---|---|
| Change the auth/ownership rules | `src/lib/server/auth.ts` + `src/lib/server/auth.test.ts` |
| Add a new column to Linkies | New file in `db/migrations/` (see `002_auth_ownership.sql`) + update `db/schema.sql` |
| Add a new API route | `src/app/api/.../route.ts` — read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` first |
| Change user-visible copy | Dashboard: `src/app/dashboard/*`; Homepage: `src/app/page.tsx` + `src/components/site/live-linky-demo.tsx`; Sign-in/up: `src/app/sign{in,up}/[[...sign-*]]/page.tsx`; README |
| Change how Clerk users land in our DB | `src/app/api/webhooks/clerk/route.ts` + `src/lib/server/identity-repository.ts` |
| Work on the claim flow | `src/app/claim/[token]/page.tsx` + `src/lib/server/claim-tokens.ts` |
| Update the CLI | `cli/index.js` + `index.js` (SDK) + `index.d.ts` (types) |

---

## When in doubt

1. Read `AGENTS.md` at the repo root. It's short and it's correct.
2. Read the in-repo Next.js docs: `node_modules/next/dist/docs/`.
3. Grep for the concept. The codebase is small and the patterns are consistent.
4. If something contradicts this skill, the code wins — then fix this skill in the same commit.
