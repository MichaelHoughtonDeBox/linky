# Changelog

All notable changes to `getalinky` are recorded here. The package
tracks the Linky hosted product's feature surface — every release widens
the CLI / SDK / MCP surfaces to match what `getalinky.com` already
supports.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). This
project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.0] — 2026-04-20

**First public npm release.** The 0.2.0 entry below was a pre-release
baseline; this is the first version actually published to the registry.
Package name is `getalinky` — matches the `getalinky.com` domain. The
earlier internal `@linky/linky` scoped name was never published, so no
rename-in-registry is needed.

### Changed — package identity

- **Package name**: `getalinky` (unscoped). `npm install getalinky`.
- **Bin names**: `getalinky` (primary), `linky`, `linkie` (compat).
  All three dispatch to the same CLI — pick whichever reads best in
  your terminal, config, or README.

### Added — bearer auth + scoped API keys (Sprints 2.6 + 2.7)

- **`Authorization: Bearer <key>` auth** across CLI, SDK, and HTTP. Keys
  are minted at `/dashboard/api-keys` or via `linky auth keys create`.
- **Three-scope allow-list** locked at mint time: `links:read`,
  `links:write`, `keys:admin`. `links:write` implies `links:read`;
  `keys:admin` implies both.
- **`linky update <slug>`** — edit urls, title, description, url
  metadata, and resolution policy from the terminal.
- **`linky auth whoami` / `set-key` / `clear`** — identity probe +
  local key storage at `~/.config/linky/config.json`.

### Added — identity-aware resolution at create time (Sprint 2.5)

- **`--policy <file>`** CLI flag and **`resolutionPolicy`** SDK +
  HTTP field so a Linky is born personalized — `/l/<slug>` evaluates
  the policy against every viewer from the very first click.
- **DSL** operators: `always`, `anonymous`, `signedIn`, `equals`,
  `in`, `endsWith`, `exists`, `and`, `or`, `not`. Viewer fields:
  `email`, `emailDomain`, `userId`, `githubLogin`, `googleEmail`,
  `orgIds`, `orgSlugs`.

### Added — owner-side analytics (Sprint 2.7)

- **`linky insights <slug>`** — terminal-rendered sparkline + totals +
  per-rule breakdown. `--range 7d|30d|90d --json` supported.
- **`GET /api/links/:slug/insights`** — aggregated DTO with `totals`,
  `byRule` (with dangling rule ids surfacing as `"(removed rule)"`),
  `series`. No viewer identity ever leaves the server.

### Added — role-aware access control (Sprint 2.7)

- **Three-role matrix** derived from `memberships.role`:
  `admin` / `editor` / `viewer`.
- **Gated actions**: view (`viewer+`), edit (`editor+`),
  delete + key management (`admin` only).

### Added — full CLI surface parity with the API (Sprint 2.8 Chunk C)

- `linky list [--limit N --offset N --json]`
- `linky get <slug> [--json]`
- `linky history <slug> [--json]`
- `linky insights <slug> [--range 7d|30d|90d --json]`
- `linky delete <slug> --force`
- `linky auth keys list [--json]`
- `linky auth keys create <name> [--scopes links:read,links:write] [--rate-limit N] [--json]`
- `linky auth keys revoke <id>`

### Added — first-class MCP server (Sprint 2.8)

- **`linky mcp` stdio bridge** — start this as an MCP server inside
  any stdio-speaking agent harness. Forwards tool calls over HTTPS
  to the hosted `/api/mcp` endpoint.
- **`/api/mcp` Streamable-HTTP endpoint** on the hosted side — paste
  the `mcp.json` snippet from `/docs/mcp` into Cursor, Claude
  Desktop, Codex, Continue, or Cline and agents get 11 tools:
  `linky_create`, `linky_list`, `linky_get`, `linky_update`,
  `linky_delete`, `linky_versions`, `linky_insights`, `whoami`,
  `keys_list`, `keys_create`, `keys_revoke`.
- **Server-side scope + role enforcement** — a `links:read` key
  attempting `linky_update` returns MCP error `-32002` with the
  missing scope named in the message.

### Added — `LinkyClient` SDK class + typed errors (Sprint 2.8 Chunk 0)

- **`import { LinkyClient, LinkyApiError } from "getalinky/sdk"`** —
  plain JS, zero runtime deps. One method per authed HTTP route
  (`createLinky`, `getLinky`, `listLinkies`, `updateLinky`,
  `deleteLinky`, `getVersions`, `getInsights`, `whoami`, `listKeys`,
  `createKey`, `revokeKey`).
- **`LinkyApiError`** — typed error with `code`, `statusCode`,
  `details`, `retryAfterSeconds` (on 429). Switch on `error.code`
  without string-matching the message.

### Added — per-key rate limits (Sprint 2.8 Chunk D)

- **`rateLimitPerHour` column on API keys** — default 1000/hour,
  configurable at mint time (range 0–100000; `0` disables for
  admin/internal keys). Exhausted keys return HTTP 429 with
  `retryAfterSeconds` in the body (MCP error `-32004`).

### Added — agent skill (`skills/linky/SKILL.md`)

- **Ships in the npm tarball** (new in this release). Copy to
  `~/.agents/skills/linky/SKILL.md` or `~/.claude/skills/linky/SKILL.md`
  after `npm install`.
- **MCP-first** onboarding: agents learn which transport to pick,
  how scopes work, what the 11 MCP tools do, every CLI command,
  and the specific "don't paste `keys:admin` into an LLM context"
  rule.

### Changed

- **SDK default export** (`createLinky`, `updateLinky`) unchanged;
  continues to work as the zero-config convenience path.
- **`Linky-Client` request header** now accepted on every authed
  mutating route for ops attribution (convention: `<tool>/<version>`,
  e.g. `cursor/skill-v1`). Malformed values are silently dropped.

### Removed

- Nothing — every 0.2.0 shape is preserved.

### Deprecated

- Nothing.

### Security

- **Scopes let you put a Linky key in an LLM context safely** — a
  `links:read` key cannot mutate anything, full stop. Mint narrow
  scopes for agent-held keys; never hand an LLM a `keys:admin` key.
- **Per-key rate limits cap blast radius** of a leaked key at
  1000 requests/hour by default. Revoke at `/dashboard/api-keys` or
  via `linky auth keys revoke <id>`.

## [0.2.0] — 2026-04-17 (pre-release, not published)

Baseline version for early development. Not published to npm. Contents
shipped in the first public release as 0.3.0.

- Anonymous `POST /api/links` creation path.
- Top-level `createLinky()` SDK function.
- Basic CLI: `linky create`, `linky <url1> <url2> ...`.
- Launcher page at `/l/<slug>` with Open All button.
