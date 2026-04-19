import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import packageJson from "../../../../package.json";
import {
  authenticateBearerToken,
  AuthRequiredError,
} from "@/lib/server/auth";

import {
  MCP_ERROR_CODES,
  toMcpError,
  toolDefinitions,
  toolHandlers,
} from "./tools";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================================
// MCP Streamable-HTTP endpoint — Sprint 2.8 Chunk A.
//
// One endpoint, one JSON-RPC envelope per request. A Claude Desktop /
// Cursor / Codex / Continue / Cline config pointing at
// `https://<host>/api/mcp` with an `Authorization: Bearer lkyu_…` header
// gets the full 11-tool surface.
//
// Design decisions locked here (echoing the sprint plan):
//
//   1. STATELESS. Every request mints a fresh `Server` + transport. No
//      per-session state is kept between calls. We have no long-running
//      tools (streaming insights, etc.) so sessions would just be
//      complexity without benefit. `sessionIdGenerator: undefined` in
//      the transport options opts into stateless mode.
//
//   2. BEARER-ONLY. `authenticateBearerToken` rejects anonymous calls
//      with `AuthRequiredError`. We deliberately skip the Clerk session
//      fallback — agent harnesses don't carry cookies, and the
//      scope-claim model from Sprint 2.7 Chunk D only applies to API
//      keys. Session users who want to test the MCP surface mint a
//      personal `links:read` key in `/dashboard/api-keys`.
//
//   3. KILL-SWITCH. Setting `LINKY_MCP_ENABLED=false` returns 503 with
//      a clear message before any auth or SDK work runs. Useful during
//      incidents; irrelevant in steady state.
//
//   4. GET RETURNS 405. Streamable HTTP uses GET for server-initiated
//      SSE streams (which we don't emit). Returning 405 makes failures
//      loud instead of letting a misconfigured client hang on an empty
//      stream.
// ============================================================================

function isEnabled(): boolean {
  const raw = process.env.LINKY_MCP_ENABLED;
  if (raw === undefined) return true;
  return raw !== "false" && raw !== "0";
}

function killSwitchResponse(): Response {
  return Response.json(
    {
      error:
        "MCP endpoint is currently disabled by the operator (LINKY_MCP_ENABLED=false).",
      code: "MCP_DISABLED",
    },
    { status: 503 },
  );
}

function toAuthErrorResponse(error: AuthRequiredError): Response {
  // Pre-envelope auth failure. We return a real HTTP 401 rather than a
  // JSON-RPC error envelope because the MCP client hasn't yet parsed
  // a request — Claude / Cursor surface HTTP-level status codes directly
  // in their "Connection failed" UI. The JSON body is a fallback for
  // curl / mcp-inspector.
  return Response.json(
    { error: error.message, code: "UNAUTHORIZED" },
    {
      status: 401,
      headers: {
        // Standard bearer challenge. Tooling like `curl --user` / agent
        // harnesses with interactive credential prompts will notice.
        "WWW-Authenticate":
          'Bearer realm="linky", error="invalid_token"',
      },
    },
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!isEnabled()) return killSwitchResponse();

  // 1. Authenticate. Any failure short-circuits before we touch the SDK.
  let subject;
  try {
    subject = await authenticateBearerToken(request);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return toAuthErrorResponse(error);
    }
    throw error;
  }

  // 2. Mint a fresh stateless server for this request. Every tool handler
  // closes over `subject`, so the MCP call inherits the bearer's scope +
  // role context without any additional plumbing.
  const server = new Server(
    { name: "linky", version: packageJson.version },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: toolDefinitions,
  }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const handler = toolHandlers[req.params.name];
    if (!handler) {
      // Unknown tool name → MethodNotFound-style error. We reuse the
      // InvalidParams envelope because tool-name-not-found is a caller-
      // side bug, not a transport-level issue. The message names the
      // tool so an agent harness can surface it verbatim.
      throw new (await import("@modelcontextprotocol/sdk/types.js")).McpError(
        MCP_ERROR_CODES.InvalidParams,
        `Unknown tool: ${req.params.name}`,
      );
    }

    try {
      return await handler(req.params.arguments ?? {}, subject);
    } catch (error) {
      // Map service errors into MCP errors. Unknown errors become a
      // generic `-32603 Internal error` — never leak implementation
      // details to the client.
      throw toMcpError(error);
    }
  });

  // 3. Hand the request to the Streamable-HTTP transport. The transport
  // parses the JSON-RPC envelope, drives the server's request handlers,
  // and returns a `Response`. Web Standards all the way down —
  // `WebStandardStreamableHTTPServerTransport` is the runtime-agnostic
  // variant that accepts a fetch-style `Request` and returns a
  // fetch-style `Response`.
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // `enableJsonResponse: true` makes the transport reply with a
    // simple JSON body instead of an SSE stream for request-response
    // tool calls. Agent harnesses consistently handle JSON bodies
    // better than single-frame SSE, and we ship no server-initiated
    // notifications in v1.
    enableJsonResponse: true,
  });

  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET(): Promise<Response> {
  if (!isEnabled()) return killSwitchResponse();
  // Streamable HTTP uses GET for the server-initiated SSE stream. We
  // don't emit any, so reject with 405 + a clear message. Claude Desktop
  // surfaces this directly; Cursor surfaces it as "Connection failed".
  return new Response(
    "Streaming not supported; use POST with a JSON-RPC envelope.",
    {
      status: 405,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    },
  );
}

// HEAD is harmless for health probes and load balancers; returning 200
// with no body is the convention. The endpoint is live iff the kill
// switch isn't flipped.
export async function HEAD(): Promise<Response> {
  if (!isEnabled()) return killSwitchResponse();
  return new Response(null, { status: 200 });
}
