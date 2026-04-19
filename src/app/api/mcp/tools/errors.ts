import { McpError } from "@modelcontextprotocol/sdk/types.js";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import { AuthRequiredError, ForbiddenError } from "@/lib/server/auth";

// ============================================================================
// Service-error → MCP-error mapping — Sprint 2.8 Chunk A.
//
// Every handler below catches service errors and rethrows an `McpError`
// so the SDK serializes them into a JSON-RPC error envelope (not a
// successful tool result with isError: true). The codes:
//
//   -32001  (RequestTimeout in the SDK's enum, repurposed for
//            "authentication required" per the sprint plan — we use a
//            custom numeric code to avoid confusion with InvalidParams.)
//   -32002  (custom) "Forbidden" — missing scope or role
//   -32003  (custom) "Not found" — slug / key id does not exist
//   -32602  InvalidParams — validation failure (LinkyError without a
//           more specific code)
//   -32603  InternalError — anything unexpected
//
// These numbers match the "Error mapping" table in the sprint plan. The
// SDK's built-in enum (ErrorCode) uses some of the -32000 range already,
// but JSON-RPC reserves the entire -32xxx range for implementation-
// defined server errors; picking numbers outside the SDK's enum is
// explicitly allowed by the spec and keeps our envelope distinguishable
// from an SDK-internal error.
// ============================================================================

export const MCP_ERROR_CODES = {
  AuthRequired: -32001,
  Forbidden: -32002,
  NotFound: -32003,
  InvalidParams: -32602,
  InternalError: -32603,
} as const;

// Map a thrown service error into the shape the MCP SDK serializes as a
// JSON-RPC error. Unknown errors become `-32603 Internal error` with a
// generic message — never leak implementation details to the client.
export function toMcpError(error: unknown): McpError {
  if (error instanceof AuthRequiredError) {
    return new McpError(
      MCP_ERROR_CODES.AuthRequired,
      error.message,
    );
  }

  if (error instanceof ForbiddenError) {
    return new McpError(MCP_ERROR_CODES.Forbidden, error.message);
  }

  if (isLinkyError(error)) {
    if (error.code === "NOT_FOUND") {
      return new McpError(MCP_ERROR_CODES.NotFound, error.message);
    }
    if (error.code === "INTERNAL_ERROR") {
      // Don't forward the internal message — it may reveal stack-trace
      // shaped details. Log server-side and return a generic message.
      console.error("[mcp] internal error:", error);
      return new McpError(
        MCP_ERROR_CODES.InternalError,
        "Linky is temporarily unavailable. Please try again shortly.",
      );
    }
    // Everything else on a LinkyError is a 400-class validation failure.
    return new McpError(MCP_ERROR_CODES.InvalidParams, error.message, {
      code: error.code,
      details: error.details,
    });
  }

  // Unknown thrown value. Preserve the full object in server logs; surface
  // a stable generic envelope to the MCP client.
  console.error("[mcp] unexpected error:", error);
  return new McpError(
    MCP_ERROR_CODES.InternalError,
    "Unexpected server error.",
  );
}

// Narrowing helper for tests — asserts that a value came out of the MCP
// error path so tests can switch on `.code` without type gymnastics.
export function isMcpError(value: unknown): value is McpError {
  return value instanceof McpError;
}

// Re-export so other modules don't import LinkyError just to classify.
export { LinkyError };
