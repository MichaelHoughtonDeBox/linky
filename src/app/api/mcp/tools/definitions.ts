// ============================================================================
// MCP tool definitions — Sprint 2.8 Chunk A.
//
// JSON Schema for every tool in the v1 surface. Schemas are intentionally
// *strict* (`additionalProperties: false` on every object) — we'd rather
// 400 loudly on an unknown property than silently drop it. See the sprint
// plan §"Open questions → 2. Tool input schema: looser or stricter?".
//
// Each definition is paired with a handler in `./handlers.ts`. A unit
// test in `mcp.test.ts` asserts every name in this file has a matching
// handler and service mapping.
// ============================================================================

export type MCPToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

// Shared sub-schemas. Extracted so a caller can see at a glance that
// `linky_create` and `linky_update` accept the same `urlMetadata` shape
// and the same policy shape.
const urlMetadataItemSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    note: { type: "string", maxLength: 500 },
    tags: {
      type: "array",
      items: { type: "string", maxLength: 40 },
      maxItems: 10,
    },
    openPolicy: { enum: ["always", "desktop", "mobile"] },
  },
};

// Resolution policy schema (Sprint 2.5). The server re-validates via
// `parseResolutionPolicy`, so we describe the outer shape only and let
// `additionalProperties: false` at the top level reject forged
// namespaces. The `when` tree is recursive — JSON Schema would need
// `$ref` to describe it fully; for the MCP tool surface we accept a
// generic `object` and let the server validator reject deep errors with
// a precise message.
const resolutionPolicySchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    version: { const: 1 },
    rules: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          when: { type: "object" },
          tabs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                url: { type: "string", format: "uri" },
                note: { type: "string", maxLength: 500 },
              },
              required: ["url"],
            },
          },
          stopOnMatch: { type: "boolean" },
          showBadge: { type: "boolean" },
        },
        required: ["when", "tabs"],
      },
    },
  },
  required: ["version", "rules"],
};

export const toolDefinitions: MCPToolDefinition[] = [
  {
    name: "linky_create",
    description:
      "Create a new Linky bundle of URLs. Returns the short URL and slug. Optional: title, description, per-URL metadata, email for claim flow, and an identity-aware resolution policy.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        urls: {
          type: "array",
          items: { type: "string", format: "uri" },
          minItems: 1,
          maxItems: 25,
        },
        title: { type: "string", maxLength: 120 },
        description: { type: "string", maxLength: 500 },
        urlMetadata: {
          type: "array",
          items: urlMetadataItemSchema,
          maxItems: 25,
        },
        metadata: { type: "object" },
        email: { type: "string", format: "email" },
        resolutionPolicy: resolutionPolicySchema,
      },
      required: ["urls"],
    },
  },
  {
    name: "linky_list",
    description:
      "List the caller's Linky bundles, newest-updated first. Owner-scoped: returns org-owned bundles when called from an org key, user-owned otherwise.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: 100 },
        offset: { type: "integer", minimum: 0 },
      },
    },
  },
  {
    name: "linky_get",
    description:
      "Read a single Linky by slug. Returns the full DTO including urls, metadata, owner, and any attached resolution policy.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string", minLength: 1 },
      },
      required: ["slug"],
    },
  },
  {
    name: "linky_update",
    description:
      "PATCH an existing Linky. At least one updatable field must be supplied: urls, urlMetadata, title, description, or resolutionPolicy. Pass resolutionPolicy=null to clear an existing policy.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string", minLength: 1 },
        urls: {
          type: "array",
          items: { type: "string", format: "uri" },
          minItems: 1,
          maxItems: 25,
        },
        urlMetadata: {
          type: "array",
          items: urlMetadataItemSchema,
          maxItems: 25,
        },
        title: { type: ["string", "null"], maxLength: 120 },
        description: { type: ["string", "null"], maxLength: 500 },
        resolutionPolicy: {
          anyOf: [{ type: "null" }, resolutionPolicySchema],
        },
      },
      required: ["slug"],
    },
  },
  {
    name: "linky_delete",
    description:
      "Soft-delete a Linky. The public launcher returns 410 afterwards. Requires admin role on org-owned bundles.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string", minLength: 1 },
      },
      required: ["slug"],
    },
  },
  {
    name: "linky_versions",
    description:
      "Append-only edit history for a Linky. Returns the version list, newest first.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string", minLength: 1 },
      },
      required: ["slug"],
    },
  },
  {
    name: "linky_insights",
    description:
      "Owner-side analytics for a Linky: totals (views / unique viewer-days / open-all rate), per-rule breakdown, and daily sparkline series. Range defaults to 30d.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        slug: { type: "string", minLength: 1 },
        range: { enum: ["7d", "30d", "90d"] },
      },
      required: ["slug"],
    },
  },
  {
    name: "whoami",
    description:
      "Identity probe. Returns the bearer subject, derived role, and attached scopes. Safe for a links:read key — does NOT require keys:admin.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "keys_list",
    description:
      "List API keys for the caller. Requires keys:admin scope; org-owned subjects also require the admin role.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {},
    },
  },
  {
    name: "keys_create",
    description:
      "Mint a new API key owned by the caller (user or active org). Requires keys:admin. Returns the raw key ONCE — store it immediately; it cannot be recovered.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string", minLength: 1, maxLength: 80 },
        scopes: {
          type: "array",
          items: { enum: ["links:read", "links:write", "keys:admin"] },
          minItems: 1,
        },
      },
      required: ["name"],
    },
  },
  {
    name: "keys_revoke",
    description:
      "Revoke an API key by numeric id. Requires keys:admin. Idempotent: already-revoked keys return their existing revocation record.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "integer", minimum: 1 },
      },
      required: ["id"],
    },
  },
];

// Name → definition index. Tests use this to assert every handler name
// has a matching definition without relying on list order.
export const toolDefinitionsByName: Record<string, MCPToolDefinition> =
  Object.fromEntries(toolDefinitions.map((def) => [def.name, def]));
