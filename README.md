<p align="center">
  <img src="./public/github-header-minimal.svg" alt="Linky header" width="100%" />
</p>

# Linky

Linky turns many URLs into one short launch link.

Hosted production URL: `https://getalinky.com`

Use it from:
- a Cursor skill (`skills/linky`)
- the web app (`/`)
- the CLI (`linky create ...`)
- the npm package API (`createLinky(...)`)
- direct HTTP (`POST /api/links`)

The short URL resolves to `/l/[slug]`, where users click **Open All** to launch each tab.

## Features

- **Anonymous creation** — public API + CLI + skill + web with basic IP rate limiting. No account required to ship a Linky.
- **Accounts (Clerk)** — users, organizations, team-owned launch bundles, SSO-ready.
- **Editable bundles** — rename, re-order URLs, add per-URL notes/tags/open policies, soft-delete. Every edit is captured as an append-only version.
- **Identity-aware resolution (Sprint 2)** — attach a rules-engine policy and `/l/[slug]` serves different tabs to different viewers based on their Clerk identity. Pure, testable, previewable in the dashboard.
- **Claim flow** — agents can create a Linky on your behalf and return a claim URL; clicking it binds ownership to your Clerk account in one click.
- **Billing scaffold (Stripe direct)** — Stripe Customers minted per user and per organization, webhook pipeline ready for plans.
- **Launcher page** with popup-blocking guidance and manual fallback links.
- **Agent-friendly CLI** with `--json`, `--email` (for the claim flow), and coloured TTY output.
- **Programmatic SDK** for scripts and agent tools.
- **Design system** — tokens, voice rules, component catalog, slide + motion recipes. See [`design/`](./design/) or the live style guide at [`/design`](https://getalinky.com/design).

## Architecture

```text
Skill / WebUI / CLI / SDK / curl / agent handoff
        |
        v
POST /api/links  ---> Neon Postgres (`linkies`, `users`, `organizations`, `linky_versions`, `claim_tokens`)
        |
        v
   /l/[slug] public launcher  ── evaluatePolicy(resolution_policy, viewerContext)
        |                                           |
        |                                           v
        |                           Clerk session → ViewerContext
        v                           (email, emailDomain, githubLogin,
   /dashboard (signed-in)            googleEmail, orgIds, orgSlugs)
        |
   /claim/[token]  (agent → human handoff)
```

## Quick Start (Local)

### 1) Install dependencies

```bash
npm install
```

### 2) Configure environment

Copy `.env.example` to `.env.local` (if it exists locally) or create `.env.local` with these variables:

```bash
# Required — core
DATABASE_URL=postgresql://...              # Neon connection string, or local Postgres
LINKY_BASE_URL=http://localhost:4040       # Public base URL used by API + launcher

# Required — Clerk (https://dashboard.clerk.com)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_WEBHOOK_SIGNING_SECRET=whsec_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/signin
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/signup

# Required — Stripe (https://dashboard.stripe.com)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SIGNING_SECRET=whsec_...

# Required — owner-side analytics (Sprint 2.7)
# 32+ character opaque string used to salt the per-day viewer hash on
# launcher_events rows. Rotate freely; rotating resets unique-viewer
# accounting for subsequent days (past days stay internally consistent).
# Leave empty to disable analytics writes — the launcher keeps working.
LINKY_DAILY_SALT=change-me-to-a-32-plus-char-secret

# Optional — rate-limit overrides (anonymous /api/links + /api/links/:slug/events)
LINKY_RATE_LIMIT_WINDOW_MS=60000
LINKY_RATE_LIMIT_MAX_REQUESTS=30
```

#### Wiring Clerk social providers (for identity-aware resolution)

Sprint 2 uses Clerk as the sole viewer-identity primitive. To let viewers
sign in with Google / GitHub (and have the DSL's `googleEmail` +
`githubLogin` fields populate at resolve time), enable those providers in
the Clerk dashboard:

1. In Clerk, navigate to **User & Authentication → Social Connections**.
2. Enable **Google** and **GitHub**. Development-mode shared credentials
   are fine for local dogfooding; provide your own OAuth credentials for
   production.
3. Ensure **Email address** is a required identifier and that the primary
   email is populated on sign-up. The policy DSL matches on
   `viewer.email` / `viewer.emailDomain` and a missing primary email
   silently disables those rules for that viewer.

No code change is required — `buildViewerContext` reads
`user.externalAccounts` and maps `provider === "oauth_github"` to
`githubLogin` and `"oauth_google"` to `googleEmail`. If Clerk renames
these providers in a future release, `viewer-context.test.ts` turns red.

#### Wiring webhooks

In the Clerk dashboard, create a webhook endpoint pointing at
`${LINKY_BASE_URL}/api/webhooks/clerk` and subscribe to every `user.*`,
`organization.*`, and `organizationMembership.*` event. Copy the signing
secret into `CLERK_WEBHOOK_SIGNING_SECRET`.

In the Stripe dashboard, create a webhook endpoint at
`${LINKY_BASE_URL}/api/webhooks/stripe`. Subscribe to
`customer.subscription.created|updated|deleted` (no state changes happen
yet in Sprint 1, but the endpoint verifies signatures and logs events).
Copy the signing secret into `STRIPE_WEBHOOK_SIGNING_SECRET`.

For local webhook testing, use [`svix`](https://docs.svix.com/receiving/testing-with-the-cli)
(Clerk) and [`stripe listen --forward-to`](https://docs.stripe.com/webhooks#test-webhook)
(Stripe) to tunnel events to `localhost:4040`.

### 3) Create or upgrade the database schema

Fresh database:

```bash
npm run db:schema
```

Existing database (applies every file in `db/migrations/` in order, idempotently):

```bash
npm run db:migrate
```

See `db/migrations/README.md` for how to author new migrations.

### 4) Start the app

```bash
npm run dev
```

App defaults to `http://localhost:4040`.

## API

### `POST /api/links` (public)

Create a new Linky and return a short URL. Stays open to anonymous callers;
ownership is attributed automatically when a Clerk session is present.

Request:

```json
{
  "urls": ["https://example.com", "https://example.org"],
  "source": "cli",
  "title": "Release review bundle",
  "description": "Open everything needed for the 2026.04 standup.",
  "urlMetadata": [
    { "note": "PR under review", "tags": ["eng"] },
    { "note": "Preview deploy", "openPolicy": "desktop" }
  ],
  "email": "alice@example.com",
  "resolutionPolicy": {
    "version": 1,
    "rules": [
      {
        "name": "Engineering team",
        "when": { "op": "endsWith", "field": "emailDomain", "value": "acme.com" },
        "tabs": [{ "url": "https://linear.app/acme/my-issues" }]
      }
    ]
  }
}
```

`resolutionPolicy` is optional (Sprint 2.5). When present, the Linky is
born personalized — signed-in viewers whose identity matches a rule see
that rule's tabs at `/l/<slug>`, while anonymous and unmatched viewers
fall through to the `urls` above. Validated through the same parser as
`PATCH /api/links/:slug`; malformed policies reject the whole create
with `400`. Agents that want to lock down a Linky from the very first
click should always pass this field.

Response (anonymous create — signed-in callers omit the `claim*` + `warning` fields):

```json
{
  "slug": "x8q2m4k",
  "url": "https://getalinky.com/l/x8q2m4k",
  "claimUrl": "https://getalinky.com/claim/B6p…",
  "claimToken": "B6p…",
  "claimExpiresAt": "2026-05-16T12:00:00.000Z",
  "warning": "Save claimToken and claimUrl now — they are returned only once and cannot be recovered."
}
```

The `claimToken` is the raw secret; `claimUrl` is a convenience that wraps
it. Agents that want to store the secret in a key-manager (and re-assemble
the URL against a different base later) should persist the token. **Returned
once, cannot be recovered.**

Optional request headers:
- `Linky-Client: <tool>/<version>` — attribute the call to an integration
  (e.g. `cursor/skill-v1`). Used for ops debugging. Malformed values are
  silently dropped; never breaks the call. Persisted under `metadata._linky.client`.

Errors:
- `400`: invalid payload (URLs, metadata, email, URL count exceeds plan limit)
- `429`: rate limit exceeded
- `500`: server/database issue

### `PATCH /api/links/:slug` (owner-only)

Edit a Linky. Every edit inserts a row into `linky_versions` so history
is never lost — including policy edits (the prior policy is snapshotted
alongside urls + metadata + title + description). Request body (all fields
optional, at least one required):

```json
{
  "title": "Release review (v2)",
  "description": null,
  "urls": ["https://example.com"],
  "urlMetadata": [{ "note": "rebuilt" }],
  "resolutionPolicy": {
    "version": 1,
    "rules": [
      {
        "name": "Engineering team",
        "showBadge": true,
        "when": {
          "op": "and",
          "of": [
            { "op": "signedIn" },
            { "op": "endsWith", "field": "emailDomain", "value": "acme.com" }
          ]
        },
        "tabs": [
          { "url": "https://linear.app/acme/my-issues", "note": "Your queue" },
          { "url": "https://github.com/acme/app/pulls?q=author:@me" }
        ]
      }
    ]
  }
}
```

Send `"resolutionPolicy": null` to clear the policy; omit the field to
leave it untouched. See the **Identity-aware resolution** section below
for the full DSL.

### `DELETE /api/links/:slug` (owner-only)

Soft-deletes the Linky. The public `/l/:slug` resolver returns 404
afterwards.

### `GET /api/me/links` (signed-in)

Paginated list of the active subject's launch bundles. Query params: `limit`
(default 20, max 100), `offset`.

### `GET /api/links/:slug/versions` (owner-only)

Append-only edit history for an owned Linky.

### `POST /api/webhooks/clerk` + `POST /api/webhooks/stripe`

Service-to-service endpoints. Verify signatures; reject unsigned requests.
Clerk events upsert users/orgs/memberships into Neon. Stripe events are
logged (entitlement updates arrive when paid plans launch).

Production `curl` example:

```bash
# Create a Linky directly through the production public API.
curl -X POST "https://getalinky.com/api/links" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": ["https://example.com", "https://example.org"],
    "source": "agent",
    "metadata": { "task": "launch-two-links" }
  }'
```

## Agent integration (MCP)

Your agent — Cursor, Claude Desktop, Codex CLI, Continue, Cline, or any
other Streamable-HTTP MCP client — can call every authed Linky route
natively. Paste one snippet, mint a scoped key, and the agent sees all
11 tools. Full walkthrough at [`/docs/mcp`](https://getalinky.com/docs/mcp).

**Cursor** (`.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "linky": {
      "url": "https://getalinky.com/api/mcp",
      "headers": {
        "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET"
      }
    }
  }
}
```

**Claude Desktop** / **Codex CLI** / any stdio-only harness — use the
bundled bridge:

```json
{
  "mcpServers": {
    "linky": {
      "command": "npx",
      "args": ["-y", "@linky/linky", "mcp"],
      "env": {
        "LINKY_API_KEY": "lkyu_YOUR_PREFIX.YOUR_SECRET",
        "LINKY_BASE_URL": "https://getalinky.com"
      }
    }
  }
}
```

Mint a key at [`/dashboard/api-keys`](https://getalinky.com/dashboard/api-keys).
`links:read` is safe to drop into any agent context — it can list, read,
and view insights, but can't write. Every key has its own hourly
rate-limit bucket (default 1000/hr; `0` = unlimited).

## Skill Install (for model workflows)

```bash
# Install the Linky skill from the GitHub repository.
npx skills add https://github.com/MichaelHoughtonDeBox/linky --skill linky
```

Verify:

```bash
npx skills list
```

## CLI

The package ships a `linky` command.

```bash
linky create <url1> <url2> [url3] ... [options]
linky update <slug> [options]
linky auth set-key <apiKey>
linky auth clear
linky auth whoami [options]
```

Options:
- `--base-url <url>` Linky API/web base URL
- `--stdin` read additional URLs from stdin
- `--email <address>` flag this Linky to be claimed by the given email after the recipient signs in
- `--title <string>` optional title stored with the Linky
- `--description <string>` optional description stored with the Linky
- `--policy <file>` attach an identity-aware resolution policy from a JSON file at create time (use `-` to read from stdin)
- `--client <id>` client attribution sent as `Linky-Client: <tool>/<version>`
- `--json` machine-readable output

Update options:
- `--title <string>` replace title
- `--description <string>` replace description
- `--description-null` clear description
- `--url <url>` replace the Linky's URL list (repeat to preserve order)
- `--urls-file <file>` replace URLs from a newline-delimited file
- `--policy <file>` replace `resolutionPolicy` from a JSON file
- `--clear-policy` clear `resolutionPolicy`
- `--api-key <key>` override the configured API key for this call
- `--client <id>` client attribution sent as `Linky-Client: <tool>/<version>`
- `--json` machine-readable output

Auth precedence for `linky update` and `linky auth whoami`:
1. `--api-key`
2. `LINKY_API_KEY`
3. stored key from `linky auth set-key`

Examples:

```bash
linky create https://example.com https://example.org
linky create https://example.com --email alice@example.com --title "Standup bundle"
linky create https://acme.com/docs --policy ./acme-team.policy.json
echo "https://example.com" | linky create --stdin --json
linky auth set-key lkyu_deadbeef.secret
linky auth whoami
linky update abc123 --title "Standup bundle v2"
linky update abc123 --policy ./acme-team.policy.json
linky update abc123 --clear-policy
```

When `--email` is used on an anonymous call, the CLI prints a `Claim this
Linky by signing in:` section with a claim URL. Clicking it (or sharing
it with the named recipient) lets them bind ownership to their account.

### API keys for automation

Create API keys from the dashboard at `/dashboard/api-keys`. Linky supports
both:

- **personal keys** — act as your user subject
- **team keys** — act as the active organization only

Team keys do **not** inherit the issuing human's personal access. They can edit
org-owned Linkies, but they cannot reach user-owned Linkies. Raw API keys are
shown once and cannot be recovered later; revoke them from the same dashboard
page if they leak or are no longer needed.

## Package API

```js
const { createLinky } = require("@linky/linky");

const result = await createLinky({
  urls: ["https://example.com", "https://example.org"],
  baseUrl: "https://getalinky.com",
  source: "agent",
  email: "alice@example.com",       // optional; enables claim flow
  title: "Release review",          // optional
  description: "Standup context",   // optional
  urlMetadata: [                    // optional; aligned with urls[]
    { note: "PR", tags: ["eng"] },
    { note: "Preview", openPolicy: "desktop" },
  ],
  resolutionPolicy: {               // optional; Sprint 2.5 "born personalized"
    version: 1,
    rules: [
      {
        name: "Engineering team",
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://linear.app/acme/my-issues" }],
      },
    ],
  },
});

console.log(result.url);                // always present
console.log(result.claimUrl);           // present only for anonymous creates
console.log(result.resolutionPolicy);   // present only when a policy was attached
```

Authenticated update:

```js
const { updateLinky } = require("@linky/linky");

const result = await updateLinky({
  slug: "abc123",
  apiKey: process.env.LINKY_API_KEY,
  title: "Release review v2",
  resolutionPolicy: null, // clear the policy
});

console.log(result.linky.slug);
console.log(result.linky.updatedAt);
```

## Claim Flow (agent → human handoff)

The agent-first moment Sprint 1 unlocks: an agent creates a Linky on your
behalf, then sends you a claim URL. One click and the Linky is yours.

1. Agent calls `POST /api/links` (or uses the CLI / SDK) without a Clerk
   session. The backend creates the Linky anonymously and mints a
   `claim_token` row with a 30-day expiry.
2. Response includes `claimUrl` (`/claim/<token>`). The CLI prints it in
   green; the SDK returns it; the web UI renders a "Keep this Linky for
   later" card.
3. User visits `/claim/<token>`:
   - **Signed-out**: landing page with Sign-in / Sign-up CTAs that
     round-trip back to the claim URL via `redirect_url`.
   - **Signed-in**: token is consumed atomically and the user is
     redirected to `/dashboard/links/<slug>` as the new owner.
4. Org context takes precedence — if the user has an active Clerk org
   when claiming, ownership is attributed to the org.

Expired / already-consumed / orphaned tokens render dedicated messaging
so failures are explainable. Claiming is a no-op on bundles that already
have an owner (prevents a race from transferring a claimed Linky a
second time).

## Identity-aware resolution (Sprint 2)

The killer primitive: one Linky, N personalized sessions.

A Linky's owner can attach a `resolutionPolicy` — a rules-engine JSON blob
stored on `linkies.resolution_policy` — and `/l/[slug]` will evaluate it
server-side on every click. The viewer's Clerk identity drives which
rule matches; unmatched and anonymous viewers always fall through to the
public URL list. The resolver is pure, tested exhaustively
(`src/lib/linky/policy.test.ts`), and shares its evaluator with the
dashboard's "Preview as" feature so authors see exactly what viewers
will see.

### Policy shape

```ts
type ResolutionPolicy = {
  version: 1;
  rules: Rule[];
};

type Rule = {
  id: string;                  // ULID-style, minted server-side if absent
  name?: string;               // owner-facing label; surfaced to viewer only if showBadge
  when: Condition;             // predicate over the viewer
  tabs: { url: string; note?: string }[];
  stopOnMatch: boolean;        // default: true (first-match-wins)
  showBadge: boolean;          // default: false (keep owner taxonomy private)
};
```

### Operators (v1)

- **Leaf** (match a viewer field): `equals`, `in`, `endsWith`, `exists`
- **Viewer state** (no field argument): `always`, `anonymous`, `signedIn`
- **Compound** (use `{ op, of: [...] }`): `and`, `or`, `not`

### Viewer fields

- **Singular**: `email`, `emailDomain`, `userId`, `githubLogin`, `googleEmail`
- **Set-valued** (use with `in`): `orgIds`, `orgSlugs`

Set-valued fields reflect the viewer's **full Clerk membership list** —
not their active workspace. A rule like
`{ "op": "in", "field": "orgSlugs", "value": ["acme"] }` matches whenever
Acme appears anywhere in the viewer's memberships, regardless of
navigation context.

### Operator × field compatibility (parse-time enforced)

`in` accepts both kinds of fields, with different semantics:

- Singular field → "viewer's value equals one of `value[]`"
  (e.g. `email in ["alice@x.com", "bob@x.com"]`)
- Set-valued field → "viewer's set intersects `value[]`"
  (e.g. `orgSlugs in ["acme", "acme-staging"]`)

`equals`, `endsWith`, and `exists` are **rejected at parse time** when
applied to `orgIds` or `orgSlugs` — use `in` with a single-element
`value` array instead. Bad policies fail loudly on PATCH.

### Semantics

1. **Rules evaluate top-to-bottom.** `stopOnMatch` defaults to `true`;
   first match wins. A rule with `stopOnMatch: false` appends its
   `tabs[]` and evaluation continues.
2. **Missing fields never throw.** An `equals` on `email` against an
   anonymous viewer returns `false`.
3. **Empty policies short-circuit.** `resolution_policy = {}` or
   `{ version: 1, rules: [] }` skips viewer-context construction entirely
   and serves the public URL list.
4. **Rule names are private by default.** The matched rule's `name` is
   only surfaced to the viewer when that rule has `showBadge: true`.
   Keeps owner-side taxonomy (e.g. "VIP Customers") internal.
5. **Size + depth limits are enforced at validate time.** Max 50 rules,
   20 tabs per rule, condition depth 4. Prevents a pathological policy
   from DoS-ing the resolver.

### Authoring a policy

The dashboard editor at `/dashboard/links/[slug]` has a Personalize
panel with two modes:

- **Structured** (default) — canned operator presets (`equals email`,
  `endsWith emailDomain`, `in orgSlugs`, `anonymous`, `signedIn`) plus
  a "Preview as" control that runs the same pure evaluator as
  `/l/[slug]`.
- **Advanced (JSON)** — raw policy with validation on Apply. Use this
  for compound `and` / `or` / `not` conditions.

### Attach at create time (Sprint 2.5) — agent-first path

Agents creating personalized Linkies should attach the policy in the
same `POST /api/links` call. This locks the Linky down from the first
click — no window where an unrestricted version is live.

CLI:

```bash
# Write the policy JSON to a file, then attach with --policy.
cat > /tmp/acme-team.policy.json <<'JSON'
{
  "version": 1,
  "rules": [
    {
      "name": "Engineering team",
      "when": { "op": "endsWith", "field": "emailDomain", "value": "acme.com" },
      "tabs": [{ "url": "https://linear.app/acme/my-issues" }]
    }
  ]
}
JSON

linky create https://acme.com/docs https://acme.com/status \
  --policy /tmp/acme-team.policy.json \
  --title "Acme standup"
```

SDK:

```js
const { createLinky } = require("@linky/linky");

await createLinky({
  urls: ["https://acme.com/docs", "https://acme.com/status"],
  source: "agent",
  title: "Acme standup",
  resolutionPolicy: {
    version: 1,
    rules: [
      {
        name: "Engineering team",
        when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
        tabs: [{ url: "https://linear.app/acme/my-issues" }],
      },
    ],
  },
});
```

The response echoes the parsed policy with server-minted rule ids, so
you can log the canonical form without a second fetch.

**Caveat — anonymous Linkies are immutable.** An anonymous create
(no Clerk session) with a policy attached locks the policy along with
the Linky. The recipient must claim the Linky via the returned
`claimUrl` before any edit (including policy edits) is possible.
Pass `email` alongside `resolutionPolicy` so the claim URL lands with
the eventual human owner.

## Deployment

### Vercel + Neon

1. Deploy this repo to Vercel.
2. Attach a Neon Postgres database (or any managed Postgres).
3. Run `npm run db:schema` (fresh) or `npm run db:migrate` (upgrade) against
   the production database.
4. Set env vars in Vercel project settings (see the Quick Start list above,
   omitting rate-limit overrides unless you need them).
5. In Clerk + Stripe dashboards, create webhook endpoints pointing at
   `https://<your-domain>/api/webhooks/clerk` and `.../stripe` with the
   signing secrets that match the env vars.
6. Add your custom domain in Vercel and point DNS records.

## Trust & lifecycle policy

These are deliberate, non-obvious product decisions. If you're evaluating
Linky against other agent-publishing tools, read this section first —
several of these are different by design.

- **Anonymous Linkies are permanent.** No TTL. `POST /api/links` without a
  Clerk session creates a bundle that stays live at `/l/<slug>` forever.
  If nobody claims it in 30 days the ownership window closes and the bundle
  becomes effectively uneditable forever — but the public URL keeps working.
  Rationale: agents emit valuable output we don't want to GC; humans tend to
  share URLs days or weeks after creation.
- **Anonymous Linkies are immutable.** There is no anonymous-edit path —
  no password, no claim-token-as-edit-credential. A URL you share with the
  world will never change under its readers. Rationale: trust.
- **Claim tokens are returned once.** Lose the token, lose the ability to
  bind the Linky to an account. Save `claimToken` + `claimUrl` to a secret
  store at create time.
- **Claim window: 30 days.** After that, the bundle stays public but
  cannot be attributed to an account. Starts at create time, is not
  extended by re-reads or passive activity.
- **Org context wins at create.** If the caller has an active Clerk org,
  `POST /api/links` attributes to the org (team-owned). Switch to Personal
  to create individually-owned Linkies. Same rule applies to the claim
  flow.
- **Three derived roles on team workspaces.** Linky maps your Clerk org
  role onto `admin` / `editor` / `viewer`. `org:admin` → admin (view +
  edit + delete + manage keys). `org:member` → editor (view + edit, no
  delete, no keys). Any `linky:editor:*` custom role → editor. Anything
  else → viewer (read-only). Privilege escalation to admin only goes
  through `org:admin`. Delete is admin-only on purpose — delete is soft
  but recovery needs a database write, so we keep that out of editor
  hands by default. Full table, mapping rules, and promotion guide live
  at [`/docs/access-control`](https://getalinky.com/docs/access-control).
  Admins can see the current member list at `/dashboard/team`.
- **API keys scope down, not up.** Every key carries one of
  `links:read` / `links:write` / `keys:admin`. A leaked `links:read` key
  cannot edit or delete. A `links:write` key cannot manage other keys.
  Scope is locked at mint; to change it, revoke and re-issue. Team API
  keys also carry the team's derived role, not the minting human's —
  they cap at editor unless the admin explicitly mints a
  `keys:admin`-scoped key.
- **Edits are append-only.** `PATCH /api/links/:slug` inserts a row into
  `linky_versions`; old state is preserved forever. `DELETE /api/links/:slug`
  soft-deletes (the public resolver returns 404; the row survives for
  audit).
- **Linky does not execute user content.** We store URLs; we do not host
  HTML, JS, or files. No password walls on the bundle itself, no proxy
  routes, no service variables. Access control for *who sees which URLs*
  is handled via identity-aware resolution — see the Sprint 2 section
  above — never via gates.
- **Linky is a low-surveillance primitive by default.** Bundles launch
  clean — no tracker-hop redirects, no fingerprint cookies on anonymous
  viewers, no "did you read this?" pings on destination tabs. We also
  cannot tell whether a tab you opened from a Linky is still open: once
  the browser navigates to a third-party origin, the Same-Origin Policy
  severs any observability by design, and that is the right default.
  Analytics that we do add will answer **owner** questions — *"did my
  intended audience arrive and see the right personalized bundle?"* —
  not **viewer** questions — *"what is Alice doing right now?"*
  Concretely that means launcher view events (with Sprint 2 policy
  match-context), "Open All" click counts, and return-visitor signal
  will ship; per-URL wrapper redirects will be strictly opt-in per
  Linky, never on by default; full cross-tab observability (the only
  way to answer *"is it still open?"*) stays gated behind an opt-in
  browser extension on the roadmap, never a silent tracker.

## Roadmap

- [x] **Accounts + editable launch bundles + per-URL metadata** — Sprint 1.
- [x] **Identity-aware URL resolution** — same Linky, different tabs per viewer. Sprint 2.
- [x] **Policy at create time via CLI / SDK / API** (`--policy` flag, `createLinky({ resolutionPolicy })`, `POST /api/links` accepts `resolutionPolicy`) — Sprint 2.5.
- [x] **Bearer API keys + `linky update <slug>` CLI command** — post-create policy editing from the terminal, plus `api_keys` with per-subject bearer auth so the CLI/SDK can authenticate as a personal or org subject without a browser session. Sprint 2.6 (anchor `72479aa`). The scope story (`links:read` / `links:write` / `keys:admin`) landed in Sprint 2.7.
- [x] **Analytics + access control** — team plan foundation. Sprint 2.7. Launcher-event instrumentation (owner-only, no viewer tracking), role-aware ownership (`viewer` / `editor` / `admin` derived from `memberships.role`), scoped API keys (`links:read` / `links:write` / `keys:admin`), and the read-only team page. See [`/docs/access-control`](./src/app/docs/access-control/page.tsx) or the live page at `/docs/access-control`.
- [x] **First-class MCP server + shared service layer + per-key rate limits** — Sprint 2.8. Every authed route extracted into a named service function (`src/lib/server/services/*`), then exposed as a Streamable-HTTP MCP endpoint at `/api/mcp` with all 11 tools (`linky_create` / `linky_list` / `linky_get` / `linky_update` / `linky_delete` / `linky_versions` / `linky_insights` / `whoami` / `keys_list` / `keys_create` / `keys_revoke`). `linky mcp` stdio bridge for harnesses that don't speak Streamable-HTTP. Per-key hourly rate limits (`api_keys.rate_limit_per_hour`, default 1000/hr, 0 = unlimited). CLI widened to 11-to-11 command parity with the MCP surface. See [`/docs/mcp`](./src/app/docs/mcp/page.tsx) or the live page at `/docs/mcp`.
- [ ] **Cursor / Claude / ChatGPT-native skills** — emit a Linky at the end of every task. *(MCP ships the underlying primitive in 2.8; first-party skill packaging is the marketing follow-up.)*
- [ ] **Browser extension** — tab-group capture and restore.

## Development Commands

```bash
npm run dev        # Start the Next.js dev server on :4040
npm run lint       # ESLint
npm run typecheck  # tsc --noEmit
npm run test       # vitest (unit tests)
npm run test:watch # vitest in watch mode
npm run build      # Next.js production build
npm run check      # lint + typecheck + test
npm run db:schema  # Apply db/schema.sql (fresh install)
npm run db:migrate # Apply db/migrations/*.sql in order (upgrade existing DB)
```

## Design system

Everything Linky looks like, speaks like, and moves like is codified in the repo:

- **[`design/tokens.json`](./design/tokens.json)** — canonical tokens (W3C DTCG format). Colors, type scale, space, radius, shadow, motion, breakpoints.
- **[`design/tokens.css`](./design/tokens.css)** — same tokens as CSS custom properties. Imported by `src/app/globals.css`.
- **[`design/brand.md`](./design/brand.md)** — positioning, voice, product language, sanctioned taglines, retired copy, competitive framing, founder-voice split.
- **[`design/color.md`](./design/color.md)**, **[`typography.md`](./design/typography.md)**, **[`logo.md`](./design/logo.md)**, **[`layout.md`](./design/layout.md)**, **[`motion.md`](./design/motion.md)**, **[`components.md`](./design/components.md)**, **[`writing.md`](./design/writing.md)**, **[`slides.md`](./design/slides.md)** — one doc per concern, each deriving from the tokens above.
- **[`/design`](https://getalinky.com/design)** — live style guide. Renders every swatch, type specimen, and component directly from `design/tokens.json`, so docs cannot drift from what ships.

Strategy (positioning, personas, launch plan) lives in [`.agents/product-marketing-context.md`](./.agents/product-marketing-context.md). The design system derives its voice rules from that doc — when PMC changes, update `design/brand.md` and `design/writing.md` in the same PR.

## Contributing

See `CONTRIBUTING.md`.

## GitHub Stars

If Linky is useful, star the repository to help more builders discover it.

[![GitHub stars](https://img.shields.io/github/stars/MichaelHoughtonDeBox/linky?style=flat-square)](https://github.com/MichaelHoughtonDeBox/linky/stargazers)

## Contributors

Contributions of all sizes are welcome.

[![GitHub contributors](https://img.shields.io/github/contributors/MichaelHoughtonDeBox/linky?style=flat-square)](https://github.com/MichaelHoughtonDeBox/linky/graphs/contributors)

[![Contributors](https://contrib.rocks/image?repo=MichaelHoughtonDeBox/linky)](https://github.com/MichaelHoughtonDeBox/linky/graphs/contributors)

## License

MIT (`LICENSE`).
