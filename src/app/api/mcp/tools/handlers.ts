import { LinkyError } from "@/lib/linky/errors";
import { parseCreateLinkyPayload, parsePatchLinkyPayload } from "@/lib/linky/schemas";
import type { AuthenticatedSubject } from "@/lib/server/auth";
import { getPublicBaseUrl } from "@/lib/server/config";
import { getLinkyInsights } from "@/lib/server/services/insights-service";
import {
  createKey,
  listKeys,
  revokeKey,
  whoAmIIdentity,
} from "@/lib/server/services/keys-service";
import {
  createLinky,
  deleteLinky,
  getLinky,
  getLinkyVersions,
  listLinkies,
  parseListPagination,
  updateLinky,
} from "@/lib/server/services/linkies-service";

// ============================================================================
// MCP tool handlers — Sprint 2.8 Chunk A.
//
// One handler per tool name. Each handler:
//   1. Unpacks `arguments` off the MCP `tools/call` request (any-typed —
//      the SDK does no JSON-Schema validation for us, so we re-run our
//      parsers from `src/lib/linky/schemas.ts` to reject bad input with
//      the same messages an HTTP caller would get).
//   2. Calls the matching service function with the authenticated subject
//      — no extra guards; the service enforces scope + role + ownership.
//   3. Returns an MCP content envelope: one text block containing the
//      pretty-printed JSON DTO. Agents can round-trip that through any
//      JSON parser (all mainstream harnesses do this automatically).
//
// Errors are NOT caught here — they propagate to `route.ts`, which runs
// them through `toMcpError()` and returns a JSON-RPC error envelope.
// This preserves MCP's convention that "tool failed" is an RPC error
// (not a success response with `isError: true`).
// ============================================================================

export type ToolContent = {
  content: Array<{ type: "text"; text: string }>;
};

export type ToolHandler = (
  args: Record<string, unknown>,
  subject: AuthenticatedSubject,
) => Promise<ToolContent>;

// Pretty-printed JSON so the tool output is readable in agent harness UIs
// that render the text verbatim. Two-space indent is the convention every
// other MCP server in the wild ships with.
function toText(value: unknown): ToolContent {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new LinkyError("Tool arguments must be a JSON object.", {
    code: "BAD_REQUEST",
    statusCode: 400,
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new LinkyError(`\`${field}\` must be a non-empty string.`, {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }
  return value;
}

function requireInteger(value: unknown, field: string): number {
  if (typeof value === "number" && Number.isFinite(value) && Number.isInteger(value)) {
    return value;
  }
  throw new LinkyError(`\`${field}\` must be an integer.`, {
    code: "BAD_REQUEST",
    statusCode: 400,
  });
}

// ---------------------------------------------------------------------------
// Handlers.
// ---------------------------------------------------------------------------

// Agents call `linky_create` from harnesses we don't own. The public base
// URL is captured once per invocation from config — we don't have the
// HTTP request here, so `getPublicBaseUrl()` falls through to
// `LINKY_BASE_URL` / `NEXT_PUBLIC_LINKY_BASE_URL` and ultimately the
// localhost fallback for self-hosters running `npm run dev`.
const linky_create: ToolHandler = async (args, subject) => {
  const payload = parseCreateLinkyPayload(args);

  const result = await createLinky(
    {
      ...payload,
      // MCP calls don't carry an IP or User-Agent by design — agents run
      // in the harness's process, not the user's browser. We pass
      // deterministic placeholders so the service's fingerprint
      // computation stays stable and attribution still lands under a
      // signed-in subject.
      clientIp: "mcp",
      userAgent: "mcp",
    },
    subject,
  );

  const baseUrl = getPublicBaseUrl();
  const url = new URL(`/l/${result.record.slug}`, baseUrl).toString();

  const response: Record<string, unknown> = {
    slug: result.record.slug,
    url,
  };

  if (result.claim) {
    response.claimUrl = new URL(
      `/claim/${result.claim.token}`,
      baseUrl,
    ).toString();
    response.claimToken = result.claim.token;
    response.claimExpiresAt = result.claim.expiresAt;
    response.warning = result.claim.warningMessage;
  }

  if (
    result.record.resolutionPolicy &&
    result.record.resolutionPolicy.rules.length > 0
  ) {
    response.resolutionPolicy = result.record.resolutionPolicy;
  }

  return toText(response);
};

const linky_list: ToolHandler = async (args, subject) => {
  const pagination = parseListPagination({
    limit: args.limit as number | string | null | undefined,
    offset: args.offset as number | string | null | undefined,
  });
  const dto = await listLinkies(pagination, subject);
  return toText(dto);
};

const linky_get: ToolHandler = async (args, subject) => {
  const slug = requireString(args.slug, "slug");
  const dto = await getLinky({ slug }, subject);
  return toText(dto);
};

const linky_update: ToolHandler = async (args, subject) => {
  const slug = requireString(args.slug, "slug");
  // Strip the slug before handing the rest off to parsePatchLinkyPayload,
  // which rejects unknown fields and requires at least one updatable
  // field to be present.
  const { slug: _slug, ...patchArgs } = args;
  void _slug;
  const patch = parsePatchLinkyPayload(patchArgs);
  const dto = await updateLinky({ ...patch, slug }, subject);
  return toText(dto);
};

const linky_delete: ToolHandler = async (args, subject) => {
  const slug = requireString(args.slug, "slug");
  const result = await deleteLinky({ slug }, subject);
  return toText(result);
};

const linky_versions: ToolHandler = async (args, subject) => {
  const slug = requireString(args.slug, "slug");
  const dto = await getLinkyVersions({ slug }, subject);
  return toText(dto);
};

const linky_insights: ToolHandler = async (args, subject) => {
  const slug = requireString(args.slug, "slug");
  const range = typeof args.range === "string" ? args.range : undefined;
  const dto = await getLinkyInsights({ slug, range }, subject);
  return toText(dto);
};

const whoami: ToolHandler = async (_args, subject) => {
  return toText(whoAmIIdentity(subject));
};

const keys_list: ToolHandler = async (_args, subject) => {
  const dto = await listKeys(subject);
  return toText(dto);
};

const keys_create: ToolHandler = async (args, subject) => {
  const dto = await createKey(
    {
      name: args.name,
      scopes: args.scopes,
    },
    subject,
  );
  // The raw key is ONCE-only — we include it verbatim in the tool text
  // output. Agent harnesses that persist tool outputs must treat it as a
  // secret; the warning string in the DTO spells that out for the
  // end-user transcript.
  return toText(dto);
};

const keys_revoke: ToolHandler = async (args, subject) => {
  const id = requireInteger(args.id, "id");
  const dto = await revokeKey({ id }, subject);
  return toText(dto);
};

// Suppress the ad-hoc `asRecord` shape guard — the MCP SDK already
// ensures `params.arguments` is an object. Exporting for unit tests that
// want to hit the guard directly.
export { asRecord };

export const toolHandlers: Record<string, ToolHandler> = {
  linky_create,
  linky_list,
  linky_get,
  linky_update,
  linky_delete,
  linky_versions,
  linky_insights,
  whoami,
  keys_list,
  keys_create,
  keys_revoke,
};
