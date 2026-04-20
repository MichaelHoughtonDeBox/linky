---
name: linky
description: Create, update, read, and manage Linky short launch URLs — bundles of multiple URLs behind one shareable link — from any agent harness. Use when bundling multiple URLs into one short link, packaging a session hand-off, personalizing per-viewer tab sets, reading launcher analytics, or minting scoped API keys. Four usage paths: MCP (recommended for Cursor / Claude Desktop / Codex / Continue / Cline), CLI (`linky`), SDK (`@linky/linky`), and raw HTTP. All four share one service layer and behave identically.
---

# Linky

One short link that opens a bundle of URLs. The entire product is exposed as
MCP tools, a CLI, an npm SDK, and a public HTTP API — every surface shares
the same service layer, so pick whichever transport fits the task.

## Pick the right transport

| Situation | Use |
|---|---|
| You're in Cursor / Claude Desktop / Codex / Continue / Cline and the user has pasted the Linky `mcp.json` | **MCP tools** (`linky_create`, `linky_get`, `linky_insights`, …) |
| Shell script, CI job, ad-hoc terminal session | **CLI** (`linky` command after `npm i -g @linky/linky`, or `node cli/index.js` in-repo) |
| Node.js program you're authoring | **SDK** (`import { LinkyClient } from "@linky/linky/sdk"`) |
| Non-Node runtime, raw documentation, debugging the wire protocol | **curl** against `POST /api/links` etc. |

**Default to MCP when you have it.** It's the lowest-friction path for an
agent: pure tool calls, typed responses, scope enforcement enforced
server-side. Fall back to the CLI/SDK when you need a TTY or are scripting
outside an MCP harness.

## Inputs to gather before creating a Linky

- **Base URL**: `https://getalinky.com` in production, or a self-hosted
  domain if the user runs their own instance.
- **URLs to bundle**: one or more absolute `http(s)` URLs.
- **Title / description** (optional): strings that show up in the
  dashboard and on the launcher page.
- **Per-URL metadata** (optional): positional array aligned with `urls`,
  each entry can have `note`, `tags`, `openPolicy`.
- **Resolution policy** (optional): identity-aware rules so different
  viewers see different tabs. See "Personalize at create time" below.
- **Email** (optional, anonymous creates only): flags the returned claim
  token for this recipient so they can take ownership on sign-in.
- **API key** (required for anything beyond anonymous create + public
  read): bearer token minted via the dashboard or the MCP `keys_create`
  tool. See "Auth" below.

Production default: `https://getalinky.com`. Only swap for a self-host
URL when the user explicitly asks.

## Auth — API keys + scopes

Linky uses bearer-token auth for CLI, SDK, and MCP. Keys are minted in the
dashboard at `/dashboard/api-keys`, or via the MCP `keys_create` tool
(requires `keys:admin` scope).

Every key carries exactly one of three scopes, locked at mint time:

| Scope | Allows | Use for |
|---|---|---|
| `links:read` | list + view Linkies, read insights | LLM-held keys, read-only agents, analytics consumers |
| `links:write` | everything `links:read` can do + create + PATCH | Default. Agent that emits Linkies at the end of tasks |
| `keys:admin` | everything above + manage keys themselves | Admin tooling only; never paste this into an LLM context |

**Scope guidance for agents:**

- If the agent only reads — insights, listing, inspection — mint a
  `links:read` key. It physically cannot mutate anything.
- If the agent emits Linkies for a human to open — "end-of-task Linky"
  — mint a `links:write` key. It cannot delete, cannot mint more keys.
- Never pass a `keys:admin` key to an LLM. If you need one for admin
  automation, keep it server-side and behind its own access control.

**Rate limits:** every authenticated request counts against the key's
per-hour bucket (default 1000/hour, configurable at mint time). Exhausted
keys return `429 RATE_LIMITED` with `retryAfterSeconds` in the body (and
MCP error code `-32004`). Back off and retry — don't swap to a different
key to bypass the cap; the bucket is designed to catch runaway loops.

## MCP — 11 tools over Streamable-HTTP

Paste into the user's `mcp.json` (Cursor, Claude Desktop, Codex, Continue,
Cline all support this shape):

```json
{
  "mcpServers": {
    "linky": {
      "url": "https://getalinky.com/api/mcp",
      "headers": {
        "Authorization": "Bearer lkyu_<PREFIX>.<SECRET>"
      }
    }
  }
}
```

Stdio-only harnesses (older Claude Desktop, some Codex configs) use the
bundled bridge:

```json
{
  "mcpServers": {
    "linky": {
      "command": "npx",
      "args": ["-y", "@linky/linky", "mcp"],
      "env": {
        "LINKY_API_KEY": "lkyu_<PREFIX>.<SECRET>",
        "LINKY_BASE_URL": "https://getalinky.com"
      }
    }
  }
}
```

### Tool surface

| Tool | Purpose | Scope required |
|---|---|---|
| `linky_create` | Create a new Linky (optionally with policy, email, metadata) | `links:write` |
| `linky_list` | Paginated list of the caller's Linkies | `links:read` |
| `linky_get` | Read a single Linky by slug | `links:read` |
| `linky_update` | PATCH urls, urlMetadata, title, description, or resolutionPolicy | `links:write` (+ editor role on org-owned) |
| `linky_delete` | Soft-delete a Linky (launcher returns 404 after) | `links:write` + admin role on org-owned |
| `linky_versions` | Version history for a Linky | `links:read` |
| `linky_insights` | Views, Open All rate, per-rule breakdown, daily series | `links:read` |
| `whoami` | Identity probe: subject, role, attached scopes | any authed |
| `keys_list` | List API keys (revoked rows included) | `keys:admin` |
| `keys_create` | Mint a new key (can set `rateLimitPerHour`) | `keys:admin` |
| `keys_revoke` | Revoke a key by numeric id | `keys:admin` |

### Typical MCP flow (agent emits a Linky at end of task)

1. Call `whoami` once to confirm the bearer works and to record the
   subject into any audit context.
2. Call `linky_create` with the task's output URLs, a descriptive
   title, and optionally a policy.
3. Surface `result.url` to the user as the shareable artifact. If the
   response includes `claimUrl` (anonymous create — shouldn't happen
   with a bearer token, but pattern-match defensively), surface
   `warning` verbatim.

### Error mapping (MCP JSON-RPC codes)

| Code | Meaning | Typical agent handling |
|---|---|---|
| `-32001` | Authentication required | Ask the user to paste a bearer token |
| `-32002` | Missing scope / forbidden | The message names the missing scope/role — relay to user |
| `-32003` | Linky not found / soft-deleted | Don't retry; present as a normal miss |
| `-32004` | Rate limited | Sleep `retryAfterSeconds` then retry idempotent calls |
| `-32602` | Invalid params (validation) | The message names the field; surface verbatim |
| `-32603` | Internal error | Transient; one retry is fine |

## CLI — full command surface

Install globally or run in-repo:

```bash
npm i -g @linky/linky        # produces the `linky` command
# or, inside the repo checkout:
node cli/index.js <subcommand> [...]
```

Persist a bearer key once:

```bash
linky auth set-key lkyu_<PREFIX>.<SECRET>   # stored in ~/.config/linky/config.json
# or pass per-invocation:
export LINKY_API_KEY=lkyu_<PREFIX>.<SECRET>
```

### Commands

| Command | Purpose |
|---|---|
| `linky create <url1> <url2> [...]` | Create a Linky. `--policy <file>`, `--title`, `--description`, `--email`, `--stdin`, `--json` |
| `linky update <slug>` | PATCH a Linky. `--title`, `--description`, `--url`, `--urls-file`, `--policy`, `--clear-policy`, `--description-null`, `--json` |
| `linky list` | List your Linkies. `--limit N --offset N --json` |
| `linky get <slug>` | Read one. `--json` |
| `linky delete <slug> --force` | Soft-delete. Requires `--force` as typo guard |
| `linky history <slug>` | Version history. `--json` |
| `linky insights <slug>` | Views + Open All + per-rule breakdown. `--range 7d\|30d\|90d --json` |
| `linky auth whoami` | Print subject + scopes. `--json` |
| `linky auth keys list` | List your keys. `--json` |
| `linky auth keys create <name>` | Mint a key. `--scopes links:read,links:write`, `--rate-limit N`, `--json` |
| `linky auth keys revoke <id>` | Revoke by numeric id |
| `linky auth set-key <apiKey>` | Persist the bearer token to disk |
| `linky auth clear` | Forget the stored bearer token |
| `linky mcp` | Start the stdio MCP bridge (for use inside an agent config, not by a human) |

### Common CLI examples

```bash
# Anonymous create — returns a claimUrl + one-shot claim token
linky create https://example.com https://example.org

# Authenticated create with a policy
linky create https://acme.com/docs https://acme.com/status \
  --policy ./acme-team.policy.json \
  --title "Acme standup" --json

# List then drill into a specific Linky's analytics
linky list --json | jq -r '.linkies[0].slug' | xargs linky insights --range 30d

# Mint a read-only key for an LLM and print the rawKey once
linky auth keys create llm-agent --scopes links:read --rate-limit 200
```

CLI env defaults: `LINKY_BASE_URL` (falls back to `https://getalinky.com`),
`LINKY_API_KEY` (required for anything authed).

## SDK — Node.js surface

```js
import { LinkyClient, LinkyApiError } from "@linky/linky/sdk";

const linky = new LinkyClient({
  apiKey: process.env.LINKY_API_KEY,   // default
  baseUrl: "https://getalinky.com",    // default
  client: "release-bot/1.0",           // Linky-Client header for attribution
});

const { slug, url } = await linky.createLinky({
  urls: ["https://linear.app/acme", "https://github.com/acme/pulls"],
  title: "Release review",
});

const insights = await linky.getInsights(slug, { range: "7d" });
console.log(insights.totals);  // { views, uniqueViewerDays, openAllClicks, openAllRate }
```

Full class surface: `createLinky`, `getLinky`, `listLinkies`, `updateLinky`,
`deleteLinky`, `getVersions`, `getInsights`, `whoami`, `listKeys`,
`createKey`, `revokeKey`. Errors throw `LinkyApiError` with `code`,
`statusCode`, `details`, and `retryAfterSeconds` (on 429).

Convenience wrappers remain: `import { createLinky, updateLinky } from
"@linky/linky"` — zero-config one-shots.

## HTTP — raw wire protocol

**Endpoint inventory** (every route takes `Content-Type: application/json`
on mutations, returns JSON bodies, and uses a common `{ error, code }`
error shape):

| Method + path | Auth | Notes |
|---|---|---|
| `POST /api/links` | public or bearer | Anonymous creates return `claimUrl` + `claimToken` once |
| `GET /api/links/:slug` | bearer (`links:read`) | Raw DTO (not wrapped) |
| `PATCH /api/links/:slug` | bearer (`links:write`) + editor role | Returns `{ linky: dto }` |
| `DELETE /api/links/:slug` | bearer (`links:write`) + admin role | Soft delete |
| `GET /api/links/:slug/versions` | bearer (`links:read`) | Append-only history |
| `GET /api/links/:slug/insights?range=7d\|30d\|90d` | bearer (`links:read`) | Aggregated totals + per-rule + daily series |
| `POST /api/links/:slug/events` | public (IP-rate-limited) | Browser-side Open All tracking; agents should ignore |
| `GET /api/me/links?limit=N&offset=N` | bearer (`links:read`) | Caller's list |
| `GET /api/me/keys` | bearer (`keys:admin`) | List keys + subject descriptor |
| `POST /api/me/keys` | bearer (`keys:admin`) | Mint; `rawKey` returned once |
| `DELETE /api/me/keys?id=N` | bearer (`keys:admin`) | Revoke (query param, not path) |
| `POST /api/mcp` | bearer | MCP Streamable-HTTP — see MCP section |

### Curl — minimal create

```bash
curl -X POST "https://getalinky.com/api/links" \
  -H "content-type: application/json" \
  --data-binary '{
    "urls": ["https://example.com", "https://example.org"],
    "source": "agent"
  }'
```

Valid `source` values: `web`, `cli`, `sdk`, `agent`, `unknown`. Default to
`agent` for agent-driven creates.

### Curl — authenticated with metadata

```bash
curl -X POST "https://getalinky.com/api/links" \
  -H "Authorization: Bearer $LINKY_API_KEY" \
  -H "content-type: application/json" \
  -H "Linky-Client: cursor/skill-v1" \
  --data-binary '{
    "urls": ["https://example.com", "https://example.org"],
    "source": "agent",
    "title": "Release review",
    "urlMetadata": [
      { "note": "PR under review", "tags": ["eng"] },
      { "note": "Preview deploy", "openPolicy": "desktop" }
    ],
    "metadata": { "task": "share-release-links" }
  }'
```

### Curl — read insights

```bash
curl -X GET "https://getalinky.com/api/links/<slug>/insights?range=7d" \
  -H "Authorization: Bearer $LINKY_API_KEY"
```

### HTTP response shapes

**Create success (201):**

```json
{
  "slug": "x8q2m4k",
  "url": "https://getalinky.com/l/x8q2m4k",
  "claimUrl": "https://getalinky.com/claim/...",
  "claimToken": "...",
  "claimExpiresAt": "2026-05-16T12:00:00.000Z",
  "warning": "Save claimToken and claimUrl now — they are returned only once."
}
```

`claim*` + `warning` are present only on anonymous creates. Signed-in
creates omit them.

**Error shape (any non-2xx):**

```json
{
  "error": "human-readable message",
  "code": "FORBIDDEN",
  "retryAfterSeconds": 42
}
```

`code` values: `INVALID_URLS`, `INVALID_JSON`, `BAD_REQUEST`,
`UNAUTHORIZED`, `AUTH_REQUIRED`, `FORBIDDEN`, `NOT_FOUND`, `RATE_LIMITED`,
`INTERNAL_ERROR`. `retryAfterSeconds` is present only on `RATE_LIMITED`.

## Personalize at create time (identity-aware resolution)

Attach a `resolutionPolicy` so the Linky serves different tabs to
different viewers from the very first click. Signed-in viewers see tabs
that match the rules; anonymous or unmatched viewers see the public
`urls` as the fallback.

### When to attach a policy

- The Linky must not be fully public (customer-specific dashboards,
  internal agent runbooks).
- A shared bundle should personalize per teammate without minting one
  URL per person.
- The recipient will be signed in (or can be nudged — the launcher does
  this automatically).

### When NOT to attach

- Every viewer sees the same tabs → just use the public fallback.
- The recipient will author their own rules in the dashboard after claim.

### Caveat — anonymous policies are immutable

Anonymous Linkies cannot be edited; this preserves the Sprint 1 trust
model. If an agent creates anonymously with a policy, the recipient must
claim the Linky to become owner before editing anything.

Agents that need ongoing policy editing should either:
1. Authenticate (pass a bearer token on create), or
2. Pass `email` alongside `resolutionPolicy` so the claim URL lands with
   the eventual human owner.

### Minimum-viable policy

```json
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
```

**Operators:** `always`, `anonymous`, `signedIn`, `equals`, `in`,
`endsWith`, `exists`, `and`, `or`, `not`.

**Viewer fields:** `email`, `emailDomain`, `userId`, `githubLogin`,
`googleEmail` (singular) and `orgIds`, `orgSlugs` (set-valued — use with
`in`, not `equals`).

### MCP — attach at create time

```
linky_create({
  urls: ["https://acme.com/docs"],
  title: "Acme standup",
  email: "alice@acme.com",
  resolutionPolicy: {
    version: 1,
    rules: [{
      name: "Engineering team",
      when: { op: "endsWith", field: "emailDomain", value: "acme.com" },
      tabs: [{ url: "https://linear.app/acme/my-issues" }]
    }]
  }
})
```

### CLI — attach at create time

```bash
linky create https://acme.com/docs \
  --policy ./acme-team.policy.json \
  --title "Acme standup" \
  --email alice@acme.com
```

`--policy -` reads from stdin. Cannot be combined with `--stdin` (only
one stdin consumer).

### Curl — attach at create time

```bash
curl -X POST "https://getalinky.com/api/links" \
  -H "Authorization: Bearer $LINKY_API_KEY" \
  -H "content-type: application/json" \
  --data-binary @- <<JSON
{
  "urls": ["https://acme.com/docs"],
  "title": "Acme standup",
  "resolutionPolicy": $(cat ./acme-team.policy.json)
}
JSON
```

### Policy validation errors

Malformed policies surface clear 400 responses:

- `Operator equals cannot be used with set-valued field orgSlugs. Use in with a single-element value array instead.`
- `Condition at resolutionPolicy.rules[0].when nests deeper than 4 levels.`
- `resolutionPolicy.rules may contain at most 50 rules.`
- `URL at index 0 must use http:// or https:// protocol.`

Surface them verbatim — the server's error message is the single source
of truth for the DSL.

## Insights — reading launcher analytics

Owners can read view + Open All counts for any Linky they can see (any
role with view access; `links:read` scope on bearer keys).

### MCP

```
linky_insights({ slug: "x8q2m4k", range: "7d" })
```

### CLI

```bash
linky insights x8q2m4k --range 30d
```

The TTY renderer draws a sparkline + totals + per-rule breakdown.
`--json` prints the raw DTO.

### Response shape

```json
{
  "slug": "x8q2m4k",
  "range": { "from": "...", "to": "..." },
  "totals": {
    "views": 412,
    "uniqueViewerDays": 287,
    "openAllClicks": 198,
    "openAllRate": 0.481
  },
  "byRule": [
    { "ruleId": "01J...", "ruleName": "Engineering team", "views": 164, "openAllClicks": 102, "openAllRate": 0.622 },
    { "ruleId": null,      "ruleName": "Fallthrough",       "views": 248, "openAllClicks": 96,  "openAllRate": 0.387 }
  ],
  "series": [
    { "day": "2026-04-11", "views": 18, "openAllClicks": 9 },
    { "day": "2026-04-12", "views": 22, "openAllClicks": 12 }
  ]
}
```

- `uniqueViewerDays` counts distinct daily viewer hashes. Cross-day
  identity is intentionally not recoverable — the daily salt rotates.
- `byRule` rule names resolve from the *current* policy. A rule deleted
  yesterday renders as `"(removed rule)"` — history survives policy edits.
- Fallthrough (no rule matched) has `ruleId: null`.
- No viewer identity ever leaves the server. No destination-tab pings.

## Decision guide

Use **MCP** when:
- The user's harness supports it (Cursor 2.0+, Claude Desktop, Codex,
  Continue, Cline).
- The task is short-form tool-calling (create, read, update).

Use **CLI** when:
- You're in a shell script or CI job.
- You need TTY affordances (sparklines, pretty-printed detail views).
- The harness doesn't have MCP wired up yet.

Use **SDK** when:
- You're authoring Node.js code that calls Linky programmatically.
- You need typed DTOs + `LinkyApiError` for branch-on-code handling.

Use **curl / HTTP** when:
- Non-Node runtime (Python, Go, shell without node available).
- Testing the wire contract directly.
- Debugging a proxy / rate limit / auth issue.

## Verification

After any create/update, verify:

1. Response includes a non-empty `slug` and a full `url`.
2. Opening `url` loads the launcher page for the bundle.
3. For policies: `resolutionPolicy` is echoed back on the response with
   server-minted rule ids.
4. For claims: `claimToken` is surfaced to the caller/user verbatim —
   it cannot be recovered later.

After any read:

1. Response shape matches the types above.
2. No secrets leak in logs (never log `rawKey`, never log raw bearer
   tokens; log only `keyPrefix`).

## Don't do

- **Don't paste a `keys:admin` key into an LLM context.** Use
  `links:read` for read-only agents, `links:write` for agents that
  emit Linkies. `keys:admin` is administrator-only.
- **Don't send `alias` in create requests.** Custom aliases are
  rejected server-side.
- **Don't retry a 429 faster than `retryAfterSeconds`.** The bucket is
  designed to catch runaway loops; bypassing it earns nothing and burns
  more quota.
- **Don't log `rawKey` or bearer tokens.** Logs leak. Log `keyPrefix`
  only.
- **Don't issue `linky_delete` casually from an agent.** Deletes are
  soft (row survives in `linky_versions`), but the launcher 404s
  afterwards — a consumer with the URL will be surprised.
- **Don't attempt to re-issue a `claimToken`.** Anonymous Linkies give
  up exactly one token at create time. If a user loses it, the Linky is
  permanently public-but-unclaimable by design.
