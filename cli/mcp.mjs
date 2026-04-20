#!/usr/bin/env node
// ============================================================================
// linky mcp — stdio ↔ Streamable-HTTP MCP bridge (Sprint 2.8 Chunk B).
//
// Harnesses that only speak stdio MCP (older Claude Desktop builds, some
// Codex configs, anything that predates the March 2025 Streamable-HTTP
// transport) still get full Linky access by running `npx getalinky
// mcp`. This process:
//
//   1. Opens a Streamable-HTTP MCP CLIENT transport against
//      ${LINKY_BASE_URL}/api/mcp with the user's ${LINKY_API_KEY} as a
//      Bearer header.
//   2. Opens a stdio MCP SERVER transport on the current process's
//      stdin/stdout.
//   3. Proxies every `tools/list` / `tools/call` call across the two
//      transports.
//
// Why "build a tiny server that uses a client" rather than pipe raw JSON
// bytes? Because the MCP protocol has an `initialize` handshake on BOTH
// sides, and each transport (stdio / Streamable-HTTP) owns that
// handshake. Trying to shortcut that by copying bytes would reimplement
// the SDK poorly. Instead we let the SDK drive each side; the bridge
// only exists in the `tools/*` request paths.
//
// Concretely: when an agent like Claude Desktop calls `tools/list`
// over stdio, our server handler fires — we then call the HTTP client's
// `.listTools()` and return what it returns. Same for `tools/call`. The
// hosted /api/mcp endpoint from Chunk A is the authoritative definition
// source; adding a new tool there automatically surfaces over stdio
// with zero bridge changes.
//
// Env:
//   LINKY_API_KEY    — required. Any `lkyu_*` / `lkyo_*` key.
//   LINKY_BASE_URL   — optional. Defaults to the production Linky URL.
// ============================================================================

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
// Pull the package version dynamically so `linky mcp` self-identifies
// to the upstream with the exact version the user has installed. One
// less source of drift between npm tags and the MCP server's
// `clientInfo.version` field.
const packageVersion = require("../package.json").version;

const DEFAULT_BASE_URL =
  process.env.LINKY_BASE_URL ||
  process.env.LINKIE_URL ||
  "https://getalinky.com";

// ANSI colors — writes go to stderr only. stdout belongs to the MCP
// protocol; any byte we write to it that isn't a JSON-RPC frame kills
// the session.
const ANSI = {
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
};

function warn(message) {
  // Only colorize when writing to a TTY. Agent harnesses typically
  // capture stderr verbatim; colored escapes inside captured logs are
  // pure noise.
  const prefix = process.stderr.isTTY
    ? `${ANSI.cyan}[linky mcp]${ANSI.reset} `
    : "[linky mcp] ";
  process.stderr.write(prefix + message + "\n");
}

function die(message) {
  const prefix = process.stderr.isTTY
    ? `${ANSI.red}[linky mcp]${ANSI.reset} `
    : "[linky mcp] ";
  process.stderr.write(prefix + message + "\n");
  process.exit(1);
}

function printHelp() {
  process.stdout.write(`linky mcp - stdio bridge to Linky's MCP endpoint

This process exposes Linky's tools over stdio MCP for harnesses that do
not speak the Streamable-HTTP transport directly. Point an agent config
at: npx -y getalinky mcp

Required env:
  LINKY_API_KEY    Bearer API key (lkyu_* or lkyo_*). Mint one at
                   https://getalinky.com/dashboard/api-keys.

Optional env:
  LINKY_BASE_URL   Upstream Linky app. Default: ${DEFAULT_BASE_URL}

Example claude_desktop_config.json entry:

  {
    "mcpServers": {
      "linky": {
        "command": "npx",
        "args": ["-y", "getalinky", "mcp"],
        "env": {
          "LINKY_API_KEY": "lkyu_your_prefix.your_secret",
          "LINKY_BASE_URL": "${DEFAULT_BASE_URL}"
        }
      }
    }
  }
`);
}

// ---------------------------------------------------------------------------
// Upstream connection.
//
// We keep the HTTP client alive for the lifetime of the process. Every
// stdio-side tool call reuses the same client so we don't pay the
// `initialize` round-trip per call. The SDK's Streamable-HTTP transport
// handles its own reconnection / backoff internally.
// ---------------------------------------------------------------------------

async function connectUpstream(baseUrl, apiKey) {
  const url = new URL("/api/mcp", baseUrl);

  const transport = new StreamableHTTPClientTransport(url, {
    // The transport uses this `requestInit` as the base for every fetch
    // it issues — initialize, tools/list, tools/call, everything. The
    // Bearer header is the ONLY auth signal the upstream honors
    // (Sprint 2.8 Chunk A `authenticateBearerToken`).
    requestInit: {
      headers: {
        authorization: `Bearer ${apiKey}`,
        // Optional attribution header; upstream logs it for ops
        // debugging but silently drops malformed values.
        "linky-client": `linky-mcp-bridge/${packageVersion}`,
      },
    },
  });

  const client = new Client(
    {
      name: "linky-mcp-bridge",
      version: packageVersion,
    },
    {
      // We don't advertise any client-side capabilities (sampling,
      // roots, etc.) — the bridge is a pure proxy, not a capability
      // origin. Keeping this empty is the cleanest way to say "I only
      // move tools/* requests around."
      capabilities: {},
    },
  );

  await client.connect(transport);
  return client;
}

// ---------------------------------------------------------------------------
// Fetch-and-cache the upstream tool catalog.
//
// We fetch once on startup so `tools/list` over stdio is cheap. New
// tools added to /api/mcp after the bridge started WILL NOT appear
// until the bridge is restarted — that's fine; harnesses typically
// re-launch the bridge per session anyway.
// ---------------------------------------------------------------------------

async function fetchToolCatalog(client) {
  const result = await client.listTools({});
  if (!Array.isArray(result.tools)) {
    throw new Error(
      "Upstream /api/mcp returned an invalid tools/list response (no tools array).",
    );
  }
  return result.tools;
}

// ---------------------------------------------------------------------------
// Forwarder.
//
// Extracted so the unit test in `cli/mcp.test.mjs` can drive it with a
// mocked upstream client. The real bridge just wires this into the
// stdio server's CallToolRequest handler.
//
// Upstream emits McpError when the HTTP side replied with a JSON-RPC
// error envelope (e.g. -32002 Forbidden). Rethrow verbatim so stdio
// clients see the same error code they'd see over Streamable-HTTP.
// Anything else is a local transport / network failure — wrap in a
// generic -32603 so the agent harness still receives a valid envelope.
// ---------------------------------------------------------------------------

export async function forwardToolCall(upstream, params) {
  try {
    return await upstream.callTool({
      name: params.name,
      arguments: params.arguments ?? {},
    });
  } catch (error) {
    if (error instanceof McpError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new McpError(
      -32603,
      `Upstream /api/mcp request failed: ${message}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Main: stdio server that forwards tool calls to the HTTP client.
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.includes("help")) {
    printHelp();
    return;
  }

  const apiKey = (process.env.LINKY_API_KEY ?? "").trim();
  if (!apiKey) {
    die(
      "LINKY_API_KEY is required. Mint a key at /dashboard/api-keys and pass it via the env block in your agent config.",
    );
  }

  const baseUrl = DEFAULT_BASE_URL;

  let upstream;
  try {
    upstream = await connectUpstream(baseUrl, apiKey);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    die(`Failed to connect to ${baseUrl}/api/mcp — ${message}`);
  }

  let tools;
  try {
    tools = await fetchToolCatalog(upstream);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    die(`Failed to load tool catalog from ${baseUrl}/api/mcp — ${message}`);
  }

  warn(
    `Connected to ${baseUrl}/api/mcp. Proxying ${tools.length} tool${tools.length === 1 ? "" : "s"}.`,
  );

  const server = new Server(
    {
      name: "linky (bridge)",
      version: packageVersion,
    },
    {
      capabilities: { tools: {} },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));

  server.setRequestHandler(CallToolRequestSchema, async (req) =>
    forwardToolCall(upstream, req.params),
  );

  const stdio = new StdioServerTransport();
  await server.connect(stdio);

  // Hold the process open until stdin closes (the agent harness
  // disconnects). `process.on("SIGINT")` + friends are optional — the
  // SDK's stdio transport cleans up on close.
  process.on("SIGTERM", () => process.exit(0));
  process.on("SIGINT", () => process.exit(0));
}

export { main };

// ---------------------------------------------------------------------------
// Entrypoint guard.
//
// We auto-run `main()` only when this module is (a) the process entry
// (`node cli/mcp.mjs`) or (b) imported by `cli/index.js` as part of the
// `linky mcp` dispatch. The second case is detected by checking for
// "linky" in `process.argv[1]` — the CLI binary is installed as `linky`
// or executed as `cli/index.js`. Tests that want to unit-test
// `forwardToolCall` without launching the stdio transport import this
// module with `process.argv[1]` pointing at a vitest worker, so this
// guard stays silent there.
// ---------------------------------------------------------------------------

import { fileURLToPath } from "node:url";
import * as pathModule from "node:path";

const thisFile = fileURLToPath(import.meta.url);
const entry = process.argv[1] ? pathModule.resolve(process.argv[1]) : "";
const entryBase = pathModule.basename(entry);
const isBridgeEntry =
  entry === thisFile ||
  entryBase === "linky" ||
  entryBase === "linkie" ||
  entry.endsWith(pathModule.join("cli", "index.js")) ||
  entry.endsWith(pathModule.join("cli", "mcp.mjs"));

if (isBridgeEntry) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    die(`Fatal: ${message}`);
  });
}
