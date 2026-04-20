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
  | { type: "user"; userId: string; scopes?: ApiKeyPermission[] }
  | { type: "org"; orgId: string; userId: string | null; role: string | null; scopes?: ApiKeyPermission[] };
```

Two auth paths resolve to the same `AuthSubject` shape:

1. **Clerk browser session** → `{ userId, orgId?, role? }`; `scopes` is
   `undefined` because signed-in humans are not scope-limited.
2. **Bearer API key** (`Authorization: Bearer lkyu_<prefix>.<secret>`) →
   same shape, but `scopes` is the key's stored array
   (`["links:read"]` / `["links:write"]` / `["keys:admin"]`). Org-scoped
   keys set `userId: null` so they cannot bleed into user-owned
   resources.

Both paths go through `src/lib/server/auth.ts`:

- **`getAuthSubject(request)`** — safe everywhere, returns `anonymous`
  when no session and no bearer.
- **`requireAuthSubject(request)`** — throws `AuthRequiredError` if
  anonymous; the common HTTP-route entrypoint.
- **`authenticateBearerToken(request)`** — MCP-only (`/api/mcp`).
  Rejects session fallback; 401 if no bearer.

### Ownership + role + scope matrix

Sprint 2.7 introduced role-aware access control for org-owned Linkies,
derived from `memberships.role` via `deriveMembershipRole()`:

| Derived role | Matches Clerk role | Can view | Can edit | Can admin |
|---|---|---|---|---|
| `admin` | `org:admin` | ✓ | ✓ | ✓ |
| `editor` | `org:member` + `linky:editor:*` custom roles | ✓ | ✓ | ✗ |
| `viewer` | anything else (incl. unknown custom roles) | ✓ | ✗ | ✗ |

Ownership helpers (all in `src/lib/server/auth.ts`, exhaustively tested
in `auth.test.ts`):

- **`canViewLinky(subject, ownership, role)`** — view access check.
- **`canEditLinky(subject, ownership, role)`** — PATCH gate.
- **`canAdminLinky(subject, ownership, role)`** — DELETE + key-management gate.
- **`requireCan*Linky(...)`** variants throw `ForbiddenError`.
- **`subjectHasScope(subject, scope)`** — scope gate for bearer subjects.
  Session subjects always return `true` (humans are not scope-limited).
- **`requireScope(subject, scope)`** — throws `ForbiddenError` naming the
  missing scope.

Add new edge cases to `auth.test.ts`, never inline. The matrix is dense
(3 subjects × 3 roles × 3 ownership shapes × 3 actions); tests encode the
27 non-equivalent cells.

### Scopes (Sprint 2.7 Chunk D)

`api_keys.scopes` is a `jsonb` array constrained to an allow-list:
`links:read`, `links:write`, `keys:admin`. Implication is resolved at
runtime by `expandScopes()` in `src/lib/server/api-keys.ts`:

- `links:write` implies `links:read`.
- `keys:admin` implies `links:write` + `links:read`.

**Scope is immutable once minted.** Changing a key's scope requires
revoke + re-issue. This keeps the threat model simple — no "quietly
escalated" keys.

### Ownership rules (strict)

- **Anonymous Linkies are immutable.** Both owner columns NULL → no
  edit, no delete, ever. Preserves the trust model: a shared public
  Linky will never change under its consumers.
- **Org context wins over user context at create time.** If the caller
  has an active Clerk org (or an org-scoped bearer), ownership goes to
  the org. Only falls back to user when no org is active.
- **Org-owned Linkies respect the role matrix above.** Editors and
  admins can PATCH; only admins can DELETE. A user must have the org as
  their **active** Clerk context to edit — ambient membership is
  intentionally not enough.
- **The only way to claim an anonymous Linky** is the `claim_tokens`
  flow via `/claim/[token]`. Do not add backdoors.

---

## Repository pattern

Data access lives in `src/lib/server/*-repository.ts`. Rules:

- Import `"server-only"` at the top. Never call from client components.
- Use `getPgPool()` from `src/lib/server/postgres.ts` (singleton, SSL-aware).
- Write raw SQL. No ORM. Parameters via `$1, $2, ...` — always parameterized, never string-interpolated.
- Normalize DB rows through a `mapDbRow` function so the rest of the app sees domain types, not Postgres shapes.
- **Mutations that touch multiple rows run in a transaction** with `FOR UPDATE` row locks. See `patchLinkyRecord` and `consumeClaimToken` for the pattern.
- Return tagged result unions for expected failure modes (`{ status: "expired" }`, `{ status: "already-owned" }`, etc.). Throw only for unexpected errors — never for control flow.

### SQL parameter-numbering gotcha

If a helper returns a clause fragment with `$N` placeholders AND a caller
prepends its own parameters to the same query, you must offset the
placeholder numbering. Sprint 2.8's Bug #4 shipped a revoke query with
`WHERE id = $1 AND ${ownership.clause}` where the ownership clause also
used `$1` — producing a collision where `$1` was bound to both the key
id (integer) and the owner column (text). Every revoke 500'd in prod.

See `subjectOwnershipClause(subject, paramOffset)` in `api-keys.ts` for
the pattern. Callers that prepend parameters MUST pass their own offset.

---

## Service layer (Sprint 2.8 Chunk 0)

Every authed HTTP route delegates to a named function in
`src/lib/server/services/`:

| File | Exports |
|---|---|
| `linkies-service.ts` | `createLinky`, `getLinky`, `listLinkies`, `updateLinky`, `deleteLinky`, `getLinkyVersions` |
| `insights-service.ts` | `getLinkyInsights` |
| `keys-service.ts` | `listKeys`, `createKey`, `revokeKey`, `whoAmIIdentity` |

### Shape rules for service functions

- Signature: `(input, subject) => Promise<DTO>`.
- **All authorization happens inside the service**: `requireScope()`,
  `requireCanViewLinky()`, `requireCanEditLinky()`, etc. Routes must
  not re-check — that's how gates drift.
- Throw typed errors: `LinkyError`, `AuthRequiredError`,
  `ForbiddenError`. Never a raw `Error` for control flow.
- Return DTOs (`src/lib/server/services/*-service.ts` exports `*Dto`
  types) — not DB rows, not `ApiKeyRecord`, not `LinkyRecord`.

### Why this layer exists

1. **HTTP route + MCP tool share one implementation.** The MCP handlers
   in `src/app/api/mcp/tools/handlers.ts` call the same service
   functions. No HTTP round-trip, no duplication, no drift.
2. **Tests hit services directly.** `linkies-service.test.ts` and
   `keys-service.test.ts` cover the auth matrix + DTO shape without
   standing up the full Next.js route.
3. **External SDK (`sdk/client.js`) talks over HTTP to the routes,
   which talk to the services.** The three transports (CLI, SDK, MCP)
   converge on the same ground truth.

### Route wrapper pattern (every authed route looks like this)

```ts
export async function GET(request: NextRequest, ctx: RouteContext) {
  try {
    const { slug } = await ctx.params;
    const subject = await requireAuthSubject(request);
    const dto = await getLinky({ slug }, subject);
    return Response.json(dto);
  } catch (error) {
    if (isKnownServerError(error)) return toErrorResponse(error);
    return toErrorResponse(new LinkyError(
      "Unexpected server error while reading Linky.",
      { code: "INTERNAL_ERROR", statusCode: 500 },
    ));
  }
}
```

Do not put business logic in the route. If you're tempted to, the logic
belongs in the service.

---

## MCP server (Sprint 2.8)

`/api/mcp` exposes every authed route as an MCP tool via the
Streamable-HTTP transport. Lives in `src/app/api/mcp/`:

| File | Purpose |
|---|---|
| `route.ts` | POST handler; auths bearer, spins up a per-request MCP server, registers tools, runs the JSON-RPC transport. Stateless by design. |
| `tools/definitions.ts` | 11 tool JSON Schemas (all `additionalProperties: false`). Authoritative input shape. |
| `tools/handlers.ts` | One handler per tool; each is a thin wrapper over a service function. |
| `tools/errors.ts` | Service-error → MCP-JSON-RPC-error mapping (`-32001..-32004` + `-32602/-32603`). |
| `tools/index.ts` | Re-exports definitions + handlers. |
| `mcp.test.ts` | Registry invariants + error mapping + handler behavior. |

### Rules for adding a new MCP tool

1. Add a service function (or reuse one) that takes
   `(input, AuthenticatedSubject) → Promise<DTO>`.
2. Add a strict JSON Schema in `tools/definitions.ts` with
   `additionalProperties: false`.
3. Add a handler in `tools/handlers.ts` that does input validation
   (`requireString`, `requireInteger`) + calls the service + wraps
   the result in `toText(dto)`.
4. Register the handler in `toolHandlers` at the bottom of
   `handlers.ts` and the registry in `index.ts`.
5. **Update `src/app/docs/mcp/page.tsx`** with the tool row + an
   example.
6. **Update the `linky` usage skill** (in `skills/linky/SKILL.md` and
   the three sync copies) with the new tool row.

### Rules for adding a new HTTP route

Every new authed route goes through the service layer and gets a
corresponding MCP tool — do not add an endpoint without its MCP
counterpart unless there's a specific reason (e.g. a browser-side
ping that's meaningless for agents). Document the reason in the plan
doc.

---

## Rate limits (Sprint 2.8 Chunk D)

Two rate-limit paths, both in-memory (`src/lib/server/rate-limit.ts`):

1. **Anonymous IP bucket** — `LINKY_RATE_LIMIT_*` env vars. Applies to
   `POST /api/links` (unauthed) and `POST /api/links/:slug/events`
   (browser Open All pings).
2. **Per-key hourly bucket** — `api_keys.rate_limit_per_hour` column.
   Applies to every authenticated request (HTTP, SDK, CLI, MCP).
   Enforced inside `authenticateApiKey` after auth succeeds.

Both reuse `checkRateLimit(bucketKey, config)`. The bucket Map attaches
to `globalThis.__linkyRateLimitBuckets` so Next.js hot-reloads don't
reset it. Horizontal scaling fragments the buckets across instances —
documented risk, accepted at current scale, to be revisited with paid
plans.

Exhausted buckets surface as `RateLimitError` with `retryAfterSeconds`,
which the HTTP layer emits as 429 + `Retry-After` header + JSON body
`retryAfterSeconds`, and the MCP layer maps to JSON-RPC code `-32004`.

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

### Migration rollout pattern (one per sprint chunk that touches schema)

Every time you write a migration, the rollout order is **fixed**:

1. **Author** `db/migrations/NNN_<short-name>.sql` and mirror the post-migration shape into `db/schema.sql` in the same commit.
2. **Apply to your local dev DB** with `npm run db:migrate` *before* you write or run any application code that expects the new columns. The failure mode of "code deployed against un-migrated schema" is hours of wasted debugging that starts with a single runtime `column ... does not exist` error.
3. **Apply to production via the Neon SQL console** (or the `user-Neon` MCP's `run_sql` / `run_sql_transaction` tools) against the production project/branch. Paste the full migration SQL — it's idempotent, so re-running is safe. Verify with `\d <affected_table>` before deploying the code that depends on it.
4. **Ship the code.** By the time Vercel is building, both DBs already have the column.

Never rely on "Vercel will run the migration for us" — we do not, by design, auto-run migrations on boot. The human or the Neon MCP is the migration runner.

### Shipped migrations (current as of Sprint 2.8)

| # | File | Ships |
|---|---|---|
| 002 | `002_auth_ownership.sql` | identity mirror, linkies, linky_versions, claim_tokens, entitlements, memberships |
| 003 | `003_resolution_policy_history.sql` | `linkies.resolution_policy`, `linky_versions.resolution_policy` |
| 004 | `004_api_keys.sql` | `api_keys` table (Sprint 2.6 bearer auth) |
| 005 | `005_launcher_events.sql` | `launcher_events` table (Sprint 2.7 analytics) |
| 006 | `006_api_key_scopes.sql` | `api_keys.scopes` JSONB (Sprint 2.7 Chunk D) |
| 007 | `007_api_key_rate_limits.sql` | `api_keys.rate_limit_per_hour` INT (Sprint 2.8 Chunk D) |

### Local env gotcha

`.env.local` stores `DATABASE_URL` with query parameters that include `&` (Neon's `channel_binding=require&sslmode=require`). `source .env.local` will choke on the ampersand. To run `psql` directly against the local env, use:

```bash
export DATABASE_URL=$(grep '^DATABASE_URL=' .env.local | cut -d= -f2-)
```

`npm run db:migrate` doesn't hit this because it reads `DATABASE_URL` from the already-exported shell env, not by parsing `.env.local` itself — so either export via the snippet above, or run migrations via the Neon SQL console / MCP and skip the shell entirely.

`.env.example` **is tracked** in git (Sprint 2.8 post-launch docs sweep
allowlisted it via `!.env.example`); keep it in sync whenever you add or
rename an environment variable a self-hoster needs.

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

## Identity-aware resolution (Sprint 2)

The DSL + evaluator live in `src/lib/linky/policy.ts`. The rules are:

- **The parser is the only validator.** `parseResolutionPolicy(raw)` hand-rolls
  shape checks, enforces operator × field compatibility (e.g. `equals` on
  `orgSlugs` is rejected at parse time — use `in`), mints missing rule ids,
  and routes every rule tab's URL through `normalizeUrlList` for parity with
  `linkies.urls`. Throws `LinkyError({ code: "BAD_REQUEST" })` on any issue.
- **`evaluatePolicy(policy, viewer, fallbackUrls)` is pure.** No DB, no env,
  no clock, no throws. Missing viewer fields return `false` at leaf
  operators. Exhaustively tested in `policy.test.ts` — add new edge cases
  there, never inline.
- **Policy edits snapshot into `linky_versions`.** `linky_versions.resolution_policy`
  is written in the same transaction as URL/metadata snapshots in
  `appendVersion`. Do not add a DSL-only edit path that skips history.
- **Empty policies short-circuit.** `/l/[slug]` skips Clerk entirely when
  `isEmptyPolicy(linky.resolutionPolicy)` is true. Keep that path fast.
- **Viewer identity is strictly Clerk.** `src/lib/server/viewer-context.ts`
  is the bridge. The pure `mapClerkToViewerContext(user, memberships)`
  helper is tested with fake shapes in `viewer-context.test.ts` — that
  test exists specifically to catch Clerk SDK provider-name drift
  (`oauth_github` → something else) before it silently breaks
  `githubLogin`/`googleEmail` population.
- **`orgIds` / `orgSlugs` are plural.** They reflect the viewer's full Clerk
  membership set, not the active workspace. Rules must target plural fields
  via `in`.
- **Rule names are private by default.** Only rules with `showBadge: true`
  surface their name to the viewer. The owner-side taxonomy stays internal
  otherwise (e.g. "VIP Customers" won't leak).
- **Policies are only exposed to owners.** The `/l/[slug]` resolver never
  ships the policy to the client — only the resolved tab set. The owner-only
  PATCH route echoes the full policy in its DTO so the dashboard editor can
  round-trip.

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
- **Do not put side effects inside `evaluatePolicy`.** The evaluator is pure by contract — no DB, no Clerk, no clock. Tests rely on it. If you need a field the DSL doesn't expose, add it to `ViewerContext` + `viewer-context.ts` first, then reference it in a new leaf operator.
- **Do not ship `linky.resolutionPolicy` to public clients.** Owner-only DTOs can echo it (the dashboard editor needs it); `/l/[slug]` only forwards the resolved tabs. Leaking the policy leaks the owner's audience taxonomy.
- **Do not call `headers()` / `auth()` inside `after()`.** Sprint 2.8's Bug #3 (every view event silently dropped for ~2 weeks in prod) was exactly this. Both are request-scoped and reject after the response closes. Capture values synchronously **before** calling `after()`, pass them as closure values. See `src/app/l/[slug]/page.tsx` for the pattern.
- **Do not put business logic in HTTP route files.** Routes are thin wrappers: parse → auth → call service → serialize. Logic lives in `src/lib/server/services/`. If you find yourself writing the same thing in a route and an MCP handler, extract to the service.
- **Do not add an MCP tool without a matching service function.** The tool handler should be ~5 lines: validate args + call service + wrap result. If it's longer, the logic belongs in a service.
- **Do not hand-code scope checks in routes.** Use `requireScope(subject, "links:read")` etc. inside the service. Scope implication (`links:write` implies `links:read`) is resolved by `expandScopes()` — don't reimplement.
- **Do not mutate `api_keys.scopes` after mint.** Scope is locked by design. To change it, revoke + re-issue.
- **Do not write raw `LINKY_DAILY_SALT` anywhere but the `viewer_hash_day` computation.** The salt is the privacy guarantee for `launcher_events`. If you find yourself logging or storing it elsewhere, stop.
- **Do not concatenate SQL clauses with placeholders without tracking the offset.** Sprint 2.8 Bug #4 shipped a `$1` collision that 500'd every revoke. Helpers that emit clauses with placeholders take a `paramOffset` argument; callers must pass the count of parameters already consumed.

---

## Quick orientation

| You want to | Start here |
|---|---|
| Change the auth/ownership rules | `src/lib/server/auth.ts` + `src/lib/server/auth.test.ts` |
| Add a scope or change scope implication | `src/lib/server/api-keys.ts` (`expandScopes`, `normalizeScopes`, `parseScopesInput`) + `src/lib/server/api-keys.test.ts` |
| Change the role derivation (admin/editor/viewer) | `src/lib/server/auth.ts` → `deriveMembershipRole` + matrix test |
| Add business logic for an existing route | `src/lib/server/services/*-service.ts` (the route is a thin wrapper) |
| Add a new column to Linkies | New file in `db/migrations/` (see `002_auth_ownership.sql`) + update `db/schema.sql` |
| Add a new API route | `src/app/api/.../route.ts` (thin wrapper) + `src/lib/server/services/*` for the logic — read `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` first |
| Add a new MCP tool | `src/app/api/mcp/tools/definitions.ts` (schema) + `handlers.ts` (handler) + register in `index.ts` + update `/docs/mcp` + update the `linky` usage skill |
| Change rate-limit behavior | `src/lib/server/api-keys.ts` (`authenticateApiKey` reads the column) + `src/lib/server/rate-limit.ts` (in-memory bucket) |
| Change user-visible copy | Dashboard: `src/app/dashboard/*`; Homepage: `src/app/page.tsx` + `src/components/site/live-linky-demo.tsx`; Sign-in/up: `src/app/sign{in,up}/[[...sign-*]]/page.tsx`; README |
| Change public docs | `src/app/docs/*/page.tsx` (sidebar: `src/components/site/docs-sidebar.tsx`) |
| Change how Clerk users land in our DB | `src/app/api/webhooks/clerk/route.ts` + `src/lib/server/identity-repository.ts` |
| Work on the claim flow | `src/app/claim/[token]/page.tsx` + `src/lib/server/claim-tokens.ts` |
| Extend the resolution policy DSL | `src/lib/linky/policy.ts` (types + parser + evaluator) + `src/lib/linky/policy.test.ts` (matrix) + `src/lib/server/viewer-context.ts` if the new field needs Clerk data |
| Update the CLI | `cli/index.js` (dispatcher) + `cli/linkies.js` / `cli/keys.js` (command groups) + `sdk/client.js` (HTTP transport) + `sdk/client.d.ts` (types) + `index.js` (top-level wrapper) |
| Add analytics to the launcher | `src/lib/server/launcher-events-repository.ts` (write path) + `src/lib/server/services/insights-service.ts` (aggregation) + `LINKY_DAILY_SALT` env var |

---

## When in doubt

1. Read `AGENTS.md` at the repo root. It's short and it's correct.
2. Read the in-repo Next.js docs: `node_modules/next/dist/docs/`.
3. Grep for the concept. The codebase is small and the patterns are consistent.
4. If something contradicts this skill, the code wins — then fix this skill in the same commit.
