# Sprint 2.8 — MCP Server + Shared Service Layer

*Status: **planning / not started**. Draft 1 — `plan/sprint-2.8-mcp`.*
*Anchor commit: `cc1bbd6 docs: /dashboard/team + /docs/access-control + trust-posture update (Sprint 2.7 chunk E) (#19)` — Sprint 2.7 shipped the scoped-API-key primitive this sprint weaponizes.*
*Previous sprints: 1 (accounts), 2 (identity-aware resolution), 2.5 (policy at create-time), 2.6 (bearer API keys + `linky update`), 2.7 (analytics + role-aware access + scoped keys).*

---

## TL;DR

Sprint 2.8 turns Linky into a **first-class agent-native tool** by exposing every authed HTTP route as an MCP tool, living inside the same Next.js app, reachable via the Streamable-HTTP transport with standard BYO-bearer-token config. One `mcp.json` snippet works across Claude Desktop, Cursor, Codex, Continue, and Cline. Self-host and hosted use the same code; users swap one URL.

Three outcomes this sprint unlocks:

1. **Agents create, read, update, and analyze Linkies without leaving their harness.** Any agent holding a `links:read` key can list + get + read insights; any agent with `links:write` can additionally create + update; any agent with `keys:admin` can manage keys. The scope story Sprint 2.7 shipped is what makes this safe enough to distribute.
2. **CLI ≡ MCP ≡ API.** All three transports compose over a single internal service layer — the CLI widens to cover the full API surface for free, the MCP server reads from the same functions, and the public SDK gets extracted into a clean package subpath.
3. **Per-key rate limits.** Today every key is unmetered except by IP. Sprint 2.8 adds a per-key hourly cap stored on `api_keys` and enforced at auth time. Free-tier users still create unlimited **anonymous** Linkies (IP-rate-limited), but a runaway agent holding one key cannot ruin us.

Everything is additive. Every existing HTTP route keeps its shape. The CLI keeps its current commands and gains more. The SDK keeps its default export. No breaking changes.

---

## Why now

- **Sprint 2.7 shipped scoped keys** (`links:read` / `links:write` / `keys:admin`). That's the one piece that was blocking a safe-to-distribute MCP — without it, every bearer token had full delete authority and putting a key in an LLM context was a foot-gun. Now it isn't.
- **MCP distribution is the current moment.** Cursor, Claude Desktop, Codex CLI, Continue, Cline, and Windsurf all ship MCP support. The Streamable-HTTP transport (introduced in MCP spec revision 2025-03-26) is the mainstream option; stdio is still the fallback for older harnesses. We get ~6 distribution surfaces from one endpoint.
- **Agents already want to emit Linkies.** The Cursor/Claude skill roadmap item exists specifically because "agent finishes a task → agent creates a Linky of the output URLs" is the killer loop. Today that's only possible through the CLI, which means shelling out. MCP makes it one tool call.
- **Stripe / paid plans wait.** Monetization is a Sprint 3 problem. Distribution is a Sprint 2.8 problem. No customer has ever paid for something they couldn't first use.

---

## Non-goals (explicit — do not slip these in)

- **No OAuth-backed MCP auth.** BYO bearer token is the v1 flow. OAuth (Cursor 2.0, Claude Desktop) is a Sprint 2.9 follow-up — it needs Clerk-side flow design, token-exchange plumbing, and a revocation story we don't need on day one.
- **No MCP resources or prompts.** We ship MCP **tools only** for v1. Resources (`linky://slug/abc`) and prompts (`/linky-bundle`) are a later decision — they're valuable but the spec is less stable and the UX is less proven.
- **No entitlement enforcement on Linky count.** Free-tier users keep creating unlimited public Linkies. `entitlements.plan` stays at `'free'` for everyone; there is no `maxLinkies` gate introduced. The abuse vector we're defending against is per-key throughput, not per-owner volume.
- **No Redis / external rate-limit store.** Per-key rate limits reuse the existing in-memory bucket implementation (`src/lib/server/rate-limit.ts`). Fragments across app instances — documented in Risks, accepted at our scale.
- **No destination-tab observability via MCP.** Same non-goal as Sprint 2.7 posture bullet 9. An agent calling `linky_insights` gets exactly what a dashboard user gets — views, Open All rate, rule breakdown — nothing more.
- **No MCP-specific docs page generator / registry submission.** We ship the manual paste-into-`mcp.json` flow. Submitting to Cursor's registry, Smithery, or the mcp.so directory is a marketing follow-up, not this sprint.
- **No CLI-side MCP client.** `linky mcp` exposes stdio transport for external agents to connect *to* us. The CLI does not become an MCP client that connects *to* other servers — different problem, different sprint.

---

## Architecture at a glance

```text
                     ┌────────────────────────────────────────────┐
                     │  Next.js app (linky.sh / self-hosted)       │
                     │  ┌──────────────────────────────────────┐   │
                     │  │ src/app/api/                         │   │
                     │  │   links/route.ts ─────────┐          │   │
                     │  │   links/[slug]/route.ts  ─┤          │   │
                     │  │   links/[slug]/versions  ─┤          │   │
                     │  │   links/[slug]/insights  ─┼── calls ─┼── src/lib/server/services/
                     │  │   me/links/route.ts      ─┤          │       linkies-service.ts
                     │  │   me/keys/route.ts       ─┤          │       keys-service.ts
                     │  │   mcp/route.ts (new)     ─┘          │       insights-service.ts
                     │  │     ↑                                │       (authoritative business logic)
                     │  │   Streamable-HTTP MCP transport      │   │
                     │  │   + stdio transport via same tools   │   │
                     │  └──────────────────────────────────────┘   │
                     └────────────────────┬───────────────────────┘
                                          │
                  ┌───────────────────────┼───────────────────────┐
                  │                       │                       │
      ┌───────────▼───────────┐ ┌─────────▼─────────┐  ┌──────────▼───────────┐
      │ Agents with native    │ │ linky CLI         │  │ linky mcp (new bin    │
      │ Streamable-HTTP MCP:  │ │ (widened to cover │  │ entry) — stdio bridge │
      │                       │ │  full API)        │  │ for older harnesses   │
      │ mcp.json paste:       │ │                   │  │                       │
      │  url + Bearer header  │ │ Uses sdk/client.js│  │ Uses MCP SDK to       │
      │                       │ │                   │  │ proxy stdio → HTTPS   │
      └───────────────────────┘ └───────────────────┘  └───────────────────────┘
                                          │
                                          ▼
                              ┌───────────────────────┐
                              │ sdk/client.js (new)   │
                              │ LinkyClient class.    │
                              │ Plain JS, zero deps.  │
                              │ Ships in @linky/linky │
                              │ via subpath export.   │
                              └───────────────────────┘
```

**Three things this diagram is saying:**

1. **The service layer is the single source of truth.** Every HTTP route becomes a thin wrapper: parse input → authenticate → call service → serialize result. The MCP route does the exact same thing with a different parser and a different serializer.
2. **The external SDK (`sdk/client.js`) is for callers outside the app process** — external CLIs, standalone scripts, other people's Node code. MCP tools **never** go through it; they go direct to the service layer because they live inside the same process.
3. **The stdio bridge is a transport, not a reimplementation.** `linky mcp` uses `@modelcontextprotocol/sdk` to accept stdio, and for every tool call it forwards to `https://<baseUrl>/api/mcp` with the user's bearer token. Adding a new tool to the Next.js app automatically makes it available over stdio with zero bridge code changes.

---

## Tool surface (v1 — exhaustive)

Every authed HTTP route gets a mirror MCP tool. Scope enforcement is server-side in the existing `requireScope()` / `canEditLinky()` / `canAdminLinky()` helpers — the MCP layer does not add new guards, it just calls the service which enforces them.

| MCP tool name | HTTP route | Min scope (bearer) | RBAC role | New CLI command |
|---|---|---|---|---|
| `linky_create` | `POST /api/links` | `links:write` | n/a | `linky create` (exists) |
| `linky_list` | `GET /api/me/links` | `links:read` | `viewer+` | `linky list` (new) |
| `linky_get` | `GET /api/links/:slug` | `links:read` | `viewer+` | `linky get <slug>` (new) |
| `linky_update` | `PATCH /api/links/:slug` | `links:write` | `editor+` | `linky update` (exists) |
| `linky_delete` | `DELETE /api/links/:slug` | `links:write` | `admin` | `linky delete <slug>` (new) |
| `linky_versions` | `GET /api/links/:slug/versions` | `links:read` | `viewer+` | `linky history <slug>` (new) |
| `linky_insights` | `GET /api/links/:slug/insights` | `links:read` | `viewer+` | `linky insights <slug>` (new) |
| `whoami` | `GET /api/me/keys` | any authed | any | `linky auth whoami` (exists) |
| `keys_list` | `GET /api/me/keys` | `keys:admin` | `admin` | `linky auth keys list` (new) |
| `keys_create` | `POST /api/me/keys` | `keys:admin` | `admin` | `linky auth keys create` (new) |
| `keys_revoke` | `DELETE /api/me/keys/:id` | `keys:admin` | `admin` | `linky auth keys revoke` (new) |

**Explicitly not exposed via MCP:**

- `POST /api/links/:slug/events` — browser-side Open All tracking, public + IP-rate-limited, semantically meaningless for an agent.
- `GET /l/:slug` — the launcher page itself is HTML for humans. Agents that want the Linky's contents call `linky_get`.

---

## Chunks

Each chunk is landable independently and passes `npm run check`. Follow the Sprint 2.7 pattern: one chunk per PR, merged to `main` behind no flag, ordered by dependency.

### Chunk 0 — Service-layer extraction + external SDK package

**Goal:** every authed route's business logic lives in a named function under `src/lib/server/services/`, and the existing top-level SDK (`index.js`, `cli/index.js`) delegates to a new plain-JS `LinkyClient` class under `sdk/`.

**Part 0a — Internal service layer:**

Extract the body of each authed route into a typed service function. Every service takes an `AuthenticatedSubject` + an input object and returns a result DTO or throws a typed error (`LinkyError`, `AuthRequiredError`, `ForbiddenError`).

```ts
// src/lib/server/services/linkies-service.ts
export async function createLinky(input: CreateLinkyInput, subject: AuthSubject | null): Promise<CreateLinkyResult>;
export async function getLinky(input: { slug: string }, subject: AuthSubject): Promise<LinkyDto>;
export async function listLinkies(input: ListLinkiesInput, subject: AuthSubject): Promise<LinkyListResponse>;
export async function updateLinky(input: UpdateLinkyInput, subject: AuthSubject): Promise<LinkyDto>;
export async function deleteLinky(input: { slug: string }, subject: AuthSubject): Promise<{ slug: string; deletedAt: string }>;
export async function getLinkyVersions(input: { slug: string }, subject: AuthSubject): Promise<LinkyVersionsResponse>;

// src/lib/server/services/insights-service.ts
export async function getLinkyInsights(input: { slug: string; range?: InsightsRange }, subject: AuthSubject): Promise<LauncherInsightsDto>;

// src/lib/server/services/keys-service.ts
export async function listKeys(subject: AuthSubject): Promise<KeyListResponse>;
export async function createKey(input: CreateKeyInput, subject: AuthSubject): Promise<CreatedKeyResponse>;
export async function revokeKey(input: { id: number }, subject: AuthSubject): Promise<{ id: number; revokedAt: string }>;
```

HTTP routes become ~20-line thin wrappers: parse + auth + call service + serialize + typed error handler. No logic moves; only the file it lives in changes.

**Part 0b — External SDK extraction:**

New folder `sdk/` at repo root (NOT under `src/`, because it ships in the npm package). Plain JS, zero runtime deps, uses global `fetch`.

```js
// sdk/client.js
export class LinkyClient {
  constructor(options) {
    this.baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
    this.apiKey = options.apiKey ?? process.env.LINKY_API_KEY;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch;
    this.clientHeader = options.client;
  }

  // One method per authed route. All return parsed JSON or throw a LinkyApiError.
  async createLinky(input) { /* POST /api/links */ }
  async getLinky(slug) { /* GET /api/links/:slug */ }
  async listLinkies(params) { /* GET /api/me/links */ }
  async updateLinky(slug, patch) { /* PATCH /api/links/:slug */ }
  async deleteLinky(slug) { /* DELETE /api/links/:slug */ }
  async getVersions(slug) { /* GET /api/links/:slug/versions */ }
  async getInsights(slug, params) { /* GET /api/links/:slug/insights */ }
  async whoami() { /* GET /api/me/keys, returns { subject, apiKeys } */ }
  async listKeys() { /* GET /api/me/keys */ }
  async createKey(input) { /* POST /api/me/keys */ }
  async revokeKey(id) { /* DELETE /api/me/keys/:id */ }
}
```

**Package exports:**

```json
// package.json
{
  "files": ["cli", "sdk", "index.js", "index.d.ts", "README.md", "LICENSE"],
  "exports": {
    ".": "./index.js",
    "./sdk": "./sdk/client.js"
  },
  "bin": {
    "linky": "./cli/index.js",
    "linkie": "./cli/index.js"
  }
}
```

**Backward compat:** `index.js` keeps `createLinky` / `updateLinky` as top-level functions, rewritten to construct a `LinkyClient` internally. Existing SDK consumers don't break.

**Files touched:**

- `src/lib/server/services/linkies-service.ts` (new)
- `src/lib/server/services/insights-service.ts` (new)
- `src/lib/server/services/keys-service.ts` (new)
- `src/lib/server/services/linkies-service.test.ts` (new)
- `src/lib/server/services/insights-service.test.ts` (new)
- `src/lib/server/services/keys-service.test.ts` (new)
- `src/app/api/links/route.ts` (thin wrapper)
- `src/app/api/links/[slug]/route.ts` (thin wrapper)
- `src/app/api/links/[slug]/versions/route.ts` (thin wrapper)
- `src/app/api/links/[slug]/insights/route.ts` (thin wrapper)
- `src/app/api/me/links/route.ts` (thin wrapper)
- `src/app/api/me/keys/route.ts` (thin wrapper)
- `sdk/client.js` (new)
- `sdk/client.d.ts` (new — full type surface, mirrors service DTOs)
- `sdk/index.js` (new — re-exports)
- `sdk/client.test.js` (new — mocked fetch)
- `index.js` (refactor to delegate)
- `cli/index.js` (refactor to use `LinkyClient`)
- `package.json` (subpath export, files entry)

**Tests:**

- Service functions: full parity with existing route tests. Each route test moves to the service layer 1:1.
- `LinkyClient`: mocked-fetch unit tests for every method. Assert URL, method, headers, request body shape, and that non-2xx responses throw a `LinkyApiError` with `{ code, statusCode, message }`.
- CLI integration: every existing CLI test still passes after refactor.

**Acceptance criteria:**

- `npm run check` green.
- No HTTP route contains business logic past `parse + auth + call service + serialize`.
- `import { LinkyClient } from "@linky/linky/sdk"` works in a consumer repo.
- Existing `import { createLinky } from "@linky/linky"` still works.

---

### Chunk A — `/api/mcp` endpoint + tool handlers

**Goal:** every tool in the table above is callable via MCP Streamable-HTTP at `/api/mcp`. Bearer auth on the HTTP request; scope + role enforcement in the service layer; results serialized as MCP tool content.

**Dependency added:**

```bash
npm i @modelcontextprotocol/sdk
```

Pinned version — this is the load-bearing dep. Note the MCP SDK's Node transport class and Server class are the two touchpoints.

**Route shape** (`src/app/api/mcp/route.ts`):

```ts
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { toolDefinitions, toolHandlers } from "./tools";
import { authenticateBearerToken } from "@/lib/server/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  // 1. Extract Authorization: Bearer <token>. 401 if missing/invalid.
  const subject = await authenticateBearerToken(request);

  // 2. Mint a stateless MCP server for this request.
  const server = new Server({ name: "linky", version: packageVersion }, {
    capabilities: { tools: {} },
  });

  // 3. Register tools with subject baked into the handler closure.
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const handler = toolHandlers[req.params.name];
    if (!handler) throw new Error(`Unknown tool: ${req.params.name}`);
    return handler(req.params.arguments ?? {}, subject);
  });

  // 4. Streamable HTTP transport handles the JSON-RPC envelope.
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET() {
  // Streamable HTTP uses GET for server-initiated streams we don't use yet.
  // Return 405 with a clear message.
  return new Response("Streaming not supported; use POST.", { status: 405 });
}
```

**Tool registry** (`src/app/api/mcp/tools/index.ts`):

```ts
export const toolDefinitions: Tool[] = [
  {
    name: "linky_create",
    description: "Create a new Linky bundle of URLs. Optionally attach a resolution policy and ownership metadata.",
    inputSchema: {
      type: "object",
      properties: {
        urls: { type: "array", items: { type: "string", format: "uri" }, minItems: 1 },
        title: { type: "string" },
        description: { type: "string" },
        urlMetadata: { type: "array", items: { /* note, tags, openPolicy */ } },
        resolutionPolicy: { type: "object" },
        email: { type: "string", format: "email" },
      },
      required: ["urls"],
    },
  },
  // ...10 more
];

export const toolHandlers: Record<string, ToolHandler> = {
  linky_create: async (args, subject) => {
    const result = await createLinky(args, subject);
    return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
  },
  // ...10 more
};
```

**Auth:**

A new `authenticateBearerToken(request)` helper in `src/lib/server/auth.ts` that rejects anonymous requests (no Clerk session fallback here — MCP is bearer-only) and returns the `AuthenticatedSubject` that services accept. Scope/role enforcement happens inside each service, unchanged.

**Error mapping:**

| Service error | MCP response |
|---|---|
| `AuthRequiredError` | MCP error with code `-32001` (custom), message "Authentication required." |
| `ForbiddenError` | MCP error with code `-32002`, message names missing scope/role |
| `LinkyError` (validation) | MCP error with code `-32602` (Invalid params), details in message |
| `LinkyError` (not found) | MCP error with code `-32003`, message "Linky not found." |
| Unexpected | MCP error with code `-32603` (Internal error), generic message; log server-side |

**Files touched:**

- `src/app/api/mcp/route.ts` (new)
- `src/app/api/mcp/tools/index.ts` (new — registry)
- `src/app/api/mcp/tools/definitions.ts` (new — JSON Schemas)
- `src/app/api/mcp/tools/handlers.ts` (new — maps name → service call + result serializer)
- `src/app/api/mcp/tools/errors.ts` (new — service-error → MCP-error mapping)
- `src/app/api/mcp/mcp.test.ts` (new — integration tests using in-memory transport)
- `src/lib/server/auth.ts` (add `authenticateBearerToken`)
- `src/proxy.ts` (make `/api/mcp` public-by-default so Clerk middleware doesn't intercept; auth happens inside)
- `package.json` (+ `@modelcontextprotocol/sdk`)

**Tests:**

- `tools/list` returns exactly the 11 tool definitions with valid JSON Schemas.
- `tools/call linky_create` with valid args → returns the same shape `POST /api/links` returns.
- Missing bearer token → HTTP 401 before MCP envelope.
- `links:read` key calling `linky_update` → MCP error with code `-32002`, message names the missing `links:write` scope.
- `links:write` key calling `linky_delete` on an org-owned Linky without admin role → MCP error with code `-32002`, message names the `admin` role.
- Valid args to every tool: returns the expected service DTO serialized as JSON text content.
- Malformed JSON-RPC envelope → HTTP 400 with parse error.

**Acceptance criteria:**

- A Claude Desktop config pointing at `http://localhost:4040/api/mcp` with a local bearer token lists all 11 tools and can call `linky_create` end-to-end.
- `mcp-inspector` CLI (`npx @modelcontextprotocol/inspector`) connects, lists tools, calls each one successfully.
- `npm run check` green.

---

### Chunk B — `linky mcp` stdio subcommand (bridge for older harnesses)

**Goal:** agents that only speak stdio MCP (some Claude Desktop versions, some Codex configs, any harness without Streamable-HTTP yet) can still use Linky by running `npx @linky/linky mcp`. The bridge reads stdio MCP messages and forwards them to the hosted `/api/mcp` endpoint via HTTPS with the configured bearer token.

**Shape** (`cli/mcp.js`):

```js
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function main() {
  const baseUrl = process.env.LINKY_BASE_URL || DEFAULT_BASE_URL;
  const apiKey = process.env.LINKY_API_KEY;
  if (!apiKey) die("LINKY_API_KEY environment variable is required for linky mcp.");

  // Fetch the tool catalog from the server so we mirror it exactly.
  const tools = await fetchToolDefinitions(baseUrl, apiKey);

  const server = new Server({ name: "linky (bridge)", version: packageVersion }, {
    capabilities: { tools: {} },
  });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    // Forward verbatim to the hosted endpoint.
    return forwardToolCall(baseUrl, apiKey, req.params);
  });

  await server.connect(new StdioServerTransport());
}

main().catch((err) => { console.error(err); process.exit(1); });
```

**Integration into existing CLI:**

Add a `linky mcp` subcommand that `exec`s this file. No new `bin` entry — keeps the npm package surface unchanged.

**User config** (Claude Desktop `claude_desktop_config.json` or equivalent):

```json
{
  "mcpServers": {
    "linky": {
      "command": "npx",
      "args": ["-y", "@linky/linky", "mcp"],
      "env": {
        "LINKY_API_KEY": "lkyu_your_prefix.your_secret",
        "LINKY_BASE_URL": "https://getalinky.com"
      }
    }
  }
}
```

**Files touched:**

- `cli/mcp.js` (new)
- `cli/index.js` (dispatch `mcp` subcommand)
- `cli/mcp.test.js` (new — unit test the forwarder with mocked fetch)

**Tests:**

- Tool list is fetched once on startup and cached.
- Forwarded tool calls hit `POST ${baseUrl}/api/mcp` with `Authorization: Bearer ${LINKY_API_KEY}`.
- Server errors propagate back through stdio with the MCP error envelope intact.

**Acceptance criteria:**

- `LINKY_API_KEY=sk_... npx linky mcp` in a Claude Desktop config makes all 11 tools visible and callable.
- `linky mcp --help` prints the config snippet above.

---

### Chunk C — Widen CLI to cover full API surface

**Goal:** the CLI exposes the same tools the MCP server does, using `LinkyClient` from the extracted SDK. Every new MCP tool has a matching CLI command.

**New commands:**

```bash
linky list [--range 30d] [--json]
linky get <slug> [--json]
linky delete <slug> [--force]
linky history <slug> [--json]
linky insights <slug> [--range 7d|30d|90d] [--json]

linky auth keys list [--json]
linky auth keys create <name> [--scopes links:read,links:write] [--json]
linky auth keys revoke <id>
```

**Design notes:**

- `--json` on every read command. Agents calling the CLI directly (yes, some still will) get structured output.
- `delete` requires `--force` as a typo-guard. Silent no-op without it, prints a reminder.
- `insights` renders a terminal sparkline for `series` by default; `--json` prints the full DTO.
- `keys create` prints the secret **once** with a warning header; the prefix is shown on subsequent `keys list` calls but the secret never is.

**Files touched:**

- `cli/index.js` (add commands, extend help)
- `cli/linkies.js` (new — list/get/delete/history/insights handlers)
- `cli/keys.js` (new — auth keys list/create/revoke handlers)
- `cli/sparkline.js` (new — 30-line terminal sparkline renderer, no deps)
- `src/app/docs/cli/page.tsx` (document new commands in the public docs page)

**Tests:**

- Each new command has an integration test that mocks fetch and asserts the correct `LinkyClient` method was called with the parsed args.
- `--json` output is valid JSON for every read command.
- `delete` without `--force` does not hit the network.
- `keys create` with an unknown scope rejects locally before sending the request.

**Acceptance criteria:**

- `linky list --json | jq '.linkies[0]'` returns the first Linky.
- `linky insights abc123` renders a readable summary with a sparkline.
- `npm run check` green.
- `/docs/cli` page shows all commands with examples.

---

### Chunk D — Per-key rate limits

**Goal:** every bearer-authenticated request counts against a per-key hourly bucket. When the bucket is empty, the request 429s with `Retry-After` set. Runaway agents burn their own quota, not ours.

**Schema change** — new migration `db/migrations/007_api_key_rate_limits.sql`:

```sql
BEGIN;

ALTER TABLE api_keys
  ADD COLUMN IF NOT EXISTS rate_limit_per_hour INTEGER NOT NULL DEFAULT 1000;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'api_keys_rate_limit_per_hour_positive') THEN
    ALTER TABLE api_keys
      ADD CONSTRAINT api_keys_rate_limit_per_hour_positive
      CHECK (rate_limit_per_hour >= 0);
  END IF;
END
$$;

COMMIT;
```

- Default `1000/hour` — generous enough to never bite a legitimate agent, stingy enough to catch a runaway loop within seconds.
- `0` means disabled — for admin/internal keys that must never rate-limit.
- Existing keys get `1000` on migration (via DEFAULT).

**Enforcement** (`src/lib/server/api-keys.ts`):

Extend `authenticateApiKey(token)` to return the `rate_limit_per_hour` on the subject. Call `checkRateLimit(\`apikey:${keyId}\`, { windowMs: 3_600_000, maxRequests: limit })` immediately after auth succeeds. On deny, throw a new `RateLimitError` with `retryAfterSeconds`.

**New error type** (`src/lib/linky/errors.ts`):

```ts
export class RateLimitError extends Error {
  readonly code = "RATE_LIMITED";
  readonly statusCode = 429;
  readonly retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Rate limit exceeded. Retry after the configured window.");
    this.retryAfterSeconds = retryAfterSeconds;
  }
}
```

**Response shape** (HTTP route error handler):

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 42
Content-Type: application/json

{"error": "Rate limit exceeded.", "code": "RATE_LIMITED", "retryAfterSeconds": 42}
```

**MCP response:** custom MCP error with code `-32004`, message names `retryAfterSeconds` in the body. The agent harness is expected to back off.

**UI surface:**

`/dashboard/api-keys/panel-client.tsx` gains a "Rate limit" field on the create form (default `1000`, range 0–100000). The list view shows the current limit as a column. Editing an existing key's limit is **not** in v1 (keep the immutable-after-mint posture from Sprint 2.7 Chunk D).

**Files touched:**

- `db/migrations/007_api_key_rate_limits.sql` (new)
- `db/schema.sql` (mirror)
- `src/lib/server/api-keys.ts` (column read, rate-limit call, new `RateLimitError`)
- `src/lib/server/api-keys.test.ts` (extend matrix)
- `src/lib/server/auth.ts` (propagate `rate_limit_per_hour` on subject)
- `src/lib/server/auth.test.ts`
- `src/lib/linky/errors.ts` (add `RateLimitError`)
- Every HTTP route error handler (map 429)
- `src/app/api/mcp/tools/errors.ts` (map to MCP code `-32004`)
- `src/app/dashboard/api-keys/panel-client.tsx` (form field + list column)
- `src/app/api/me/keys/route.ts` (accept + validate `rateLimitPerHour` on POST)
- `sdk/client.js` (surface `retryAfterSeconds` on `LinkyApiError`)
- `cli/index.js` (show a human message on 429)

**Tests:**

- 1001 consecutive calls with a `limit=1000` key: 1001st returns 429 with `Retry-After`.
- `limit=0` key: unlimited, no 429 ever.
- After a 429, waiting the window succeeds.
- Different keys don't interfere (different bucket keys).
- MCP call that 429s returns MCP error `-32004` with `retryAfterSeconds` in the error data.

**Acceptance criteria:**

- Existing keys still work (backfilled to 1000).
- New keys can specify a custom limit at create time, validated and persisted.
- A tight loop from one key gets 429d within seconds.
- `npm run check` green.

---

### Chunk E — Public `/docs/mcp` page + agent-harness examples

**Goal:** a single public page that walks through "how do I get an MCP key, paste this JSON, and use Linky from Cursor/Claude/Codex." Drives adoption; eliminates support round-trips.

**Scope:**

- New `/docs/mcp` page. Server component, terminal aesthetic consistent with `/docs/access-control` and `/docs/cli`.
- Sections:
  1. **What this is** — 3 sentences naming Streamable-HTTP, scoped keys, and the self-host path.
  2. **Create a read-only key** — link to `/dashboard/api-keys`, screenshot of the scope picker showing `links:read`.
  3. **Paste into your agent** — tabbed `mcp.json` for: Cursor, Claude Desktop, Codex CLI, Continue, Cline. Each tab is copy-paste-ready with a placeholder bearer token.
  4. **Verify with mcp-inspector** — one-liner to confirm the tools are visible.
  5. **Self-host** — one sentence + URL swap example.
  6. **Tool reference** — auto-generated list of the 11 tools with their JSON Schema, pulled from `src/app/api/mcp/tools/definitions.ts` at build time.
- Sidebar entry in `/docs/` navigation.
- Link from the `/dashboard/api-keys` page header ("Using an API key with an MCP agent? See `/docs/mcp`.").

**Files touched:**

- `src/app/docs/mcp/page.tsx` (new)
- `src/components/site/docs-sidebar.tsx` (add entry)
- `src/app/dashboard/api-keys/page.tsx` (link to `/docs/mcp`)
- `README.md` (new "Agent integration (MCP)" subsection under Quick Start)

**Tests:**

- Server-component render test: page renders with all 5 agent tabs + tool list.
- No broken internal links.

**Acceptance criteria:**

- A first-time user can go from `/dashboard/api-keys` to working MCP in Cursor without leaving the docs.
- `/docs/mcp` Lighthouse score ≥ 95.

---

## Rollout order

Chunks are ordered by dependency, not priority. Each merges to `main` behind no flag.

1. **Chunk 0 first.** Pure refactor with test parity. Unblocks A (services) and C (SDK). Zero user-visible change.
2. **Chunk A second.** `/api/mcp` endpoint works standalone — you can paste a `mcp.json` into an agent and use it the moment A merges. Chunks B/C/D are all independent of each other after A.
3. **Chunk B third.** Stdio bridge. Lands as soon as the hosted endpoint is live.
4. **Chunk D fourth.** Per-key rate limits. Orthogonal to MCP but must ship before we advertise hosted MCP in any public channel.
5. **Chunk C fifth.** CLI widening. Independent of MCP; sequenced after D so the new CLI commands handle 429s correctly.
6. **Chunk E last.** Docs page. Writes itself once everything above is stable.

**If we ship only 0 + A + D, the sprint is a net positive** — MCP is live, keys are safe. B/C/E can slip a week without blocking distribution. Do not ship A without D; do not ship E without A.

---

## Migrations touched

| # | File | Shape change | Chunk |
|---|---|---|---|
| 007 | `api_keys.rate_limit_per_hour INTEGER` | Per-key hourly rate limit column | D |

Follows the migration discipline in `.cursor/skills/linky-codebase/SKILL.md` → §Migration rollout pattern: idempotent SQL, mirror into `db/schema.sql` in the same commit, apply to local dev first, then production via Neon MCP, then ship the code.

---

## New environment variables

- **`LINKY_MCP_ENABLED`** (optional, default `"true"`) — kill-switch for `/api/mcp`. When `"false"`, the route returns 503 with a clear message. Useful during incidents; irrelevant in steady state.

No other new env vars. `LINKY_API_KEY` already exists in the CLI path; `LINKY_BASE_URL` is reused by the stdio bridge.

---

## Dependencies added

- `@modelcontextprotocol/sdk` — MCP server + transport implementations (Streamable HTTP + stdio). Pin the version in `package.json`; this is the one dep this sprint forces us to take.

No other new runtime deps. `sdk/client.js` uses global `fetch`.

---

## Open questions (resolve in the PR that introduces the affected chunk)

1. **Session management for Streamable HTTP** — do we mint a session per connection or stay stateless per request? *Working answer: stateless per request.* Every tool call is self-contained (no server-side state between calls); sessions add complexity we don't need. Reconsider if we add long-running tools (streaming insights, for example).

2. **Tool input schema: looser or stricter?** *Working answer: stricter.* Reject unknown properties in every tool's `inputSchema`. MCP clients that silently pass through user-provided JSON are common; we'd rather 400 loudly than accept fields we'll silently drop.

3. **Pagination on `linky_list`** — do we ship pagination in v1? *Working answer: yes, limit+offset.* `GET /api/me/links` already supports it (or needs to be upgraded in Chunk 0). Return `{ linkies: [...], nextOffset: number | null }`. Owners with 10000 Linkies exist; we don't want to discover that in prod.

4. **`keys_create` over MCP — allowed at all?** *Working answer: yes, behind `keys:admin`.* A `keys:admin` bearer holder should be able to mint new keys (that's what the scope means). We accept the "admin key mints a read-only key" loop as a feature, not a foot-gun.

5. **What about a `linky_resolve` tool** that returns what `/l/:slug` would show a specific viewer (given a mock subject)? *Working answer: not in v1.* It's a preview tool, valuable for policy authoring, but the identity-spoofing semantics need a policy decision ("can an agent simulate another user's view?"). Defer.

6. **Cursor's MCP registry** — do we submit? *Working answer: after launch.* The registry is new; we want our endpoint stable and our `/docs/mcp` page live before we submit. Sprint 2.9 marketing task.

---

## Product-marketing signals

When Sprint 2.8 ships, update:

- **`README.md`** → Roadmap: flip `[ ] First-class MCP server` → `[x]`. Add an "Agent integration (MCP)" subsection under Quick Start with the 5-agent `mcp.json` block.
- **`.agents/product-marketing-context.md`** → Shipped list gets Sprint 2.8 with the framing "agents use Linky natively." Upcoming list removes the MCP bullet.
- **`/docs/mcp`** (Chunk E) is the public anchor for every partner / evaluator / HN / Product Hunt moment.
- **Copy rule:** MCP messaging is **always** agent-framed ("your agent can create Linkies", "your Claude session becomes a teammate"), never infra-framed ("we support the MCP spec"). The agent audience cares about outcomes; the infra framing reads as a feature list.

---

## Risks

| Risk | Mitigation |
|---|---|
| `@modelcontextprotocol/sdk` ships breaking changes between minor versions | Pin exactly; `npm update` is a conscious act. Sprint plan allocates a day of buffer for spec churn during implementation. |
| In-memory rate-limit buckets fragment across app instances | Documented. At current scale (one Vercel instance most of the time) the fragmentation is meaningless. Revisit with Sprint 3 when paid plans might force us to scale horizontally. |
| Agent holding a stolen `links:write` key mints spam Linkies under a user's account | Per-key rate limit (Chunk D) caps the blast radius at 1000/hour. User revokes the key via `/dashboard/api-keys`. |
| Streamable HTTP not supported by every agent harness | Stdio bridge (Chunk B) catches every harness that speaks stdio MCP. Between them we cover 100% of current harnesses. |
| User pastes `keys:admin` key into an agent when they only needed `links:read` | `/docs/mcp` (Chunk E) shows `links:read` as the default in every copy-paste example. UI on `/dashboard/api-keys` already shows scope prominently. |
| Tool input schemas drift from service signatures | Schema lives next to the handler in `src/app/api/mcp/tools/`. Unit test asserts every tool name has a definition + a handler + a service mapping. |
| MCP endpoint becomes a DoS vector | Pre-auth rate limit on `/api/mcp` by IP (reuse `LINKY_RATE_LIMIT_*` with a dedicated bucket prefix). Post-auth rate limit by key (Chunk D). Two layers. |

---

## Exit criteria

Sprint 2.8 is done when:

1. `npm run check` green on `main` with all six chunks merged.
2. A user can create a `links:read` API key in `/dashboard/api-keys`, paste the `mcp.json` snippet from `/docs/mcp` into Cursor, and successfully call `linky_list` + `linky_get` + `linky_insights` without touching the CLI.
3. A user with a `links:write` key can, from the same agent, call `linky_create` and receive back a working short URL.
4. A user holding a `links:read` key attempting `linky_update` gets an MCP error naming the missing scope.
5. A self-hoster running `npm run dev` gets a working `/api/mcp` endpoint with no additional config beyond `DATABASE_URL` + `LINKY_DAILY_SALT` + `LINKY_API_KEY` for testing.
6. A tight agent loop on one key gets 429d within 60 seconds, with a clear error message.
7. The CLI can do everything the MCP tools can do (11-to-11 command parity).
8. The README and marketing context reflect MCP as shipped, with a clear `/docs/mcp` link.

---

## Appendix — sample `mcp.json` per harness

**Cursor** (`.cursor/mcp.json` in a project, or global user config):

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

**Claude Desktop** (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

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

**Codex CLI** (`~/.codex/config.toml`):

```toml
[mcp_servers.linky]
command = "npx"
args = ["-y", "@linky/linky", "mcp"]

[mcp_servers.linky.env]
LINKY_API_KEY = "lkyu_YOUR_PREFIX.YOUR_SECRET"
LINKY_BASE_URL = "https://getalinky.com"
```

**Continue** (`.continue/config.json`):

```json
{
  "mcpServers": [
    {
      "name": "linky",
      "transport": {
        "type": "streamable-http",
        "url": "https://getalinky.com/api/mcp",
        "headers": { "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET" }
      }
    }
  ]
}
```

**Cline** (`cline_mcp_settings.json`):

```json
{
  "mcpServers": {
    "linky": {
      "url": "https://getalinky.com/api/mcp",
      "headers": { "Authorization": "Bearer lkyu_YOUR_PREFIX.YOUR_SECRET" }
    }
  }
}
```

**Self-host**: replace `https://getalinky.com` with your domain. Everything else is identical.
