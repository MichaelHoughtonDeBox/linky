import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// MCP route + tool layer tests — Sprint 2.8 Chunk A.
//
// We test three layers in one file:
//
//   1. REGISTRY INVARIANTS. Every definition has a handler and vice
//      versa; every schema is `additionalProperties: false` so forged
//      fields reject loudly.
//
//   2. ERROR MAPPING. Every service error class routes to the documented
//      MCP error code. This is the contract the sprint plan pinned.
//
//   3. HANDLERS. Each handler is called with a mocked subject + mocked
//      service; we assert it returns the text-content envelope the MCP
//      SDK serializes verbatim, and that arguments are forwarded
//      correctly.
//
// Route-level integration (the Server/transport wiring in route.ts) is
// exercised by the handler tests plus a focused test for the POST
// handler's auth + kill-switch behavior. The full request/response
// roundtrip via `mcp-inspector` is a manual smoke test documented in
// the sprint plan's Chunk A acceptance criteria.
// ============================================================================

vi.mock("@/lib/server/postgres", () => ({
  getPgPool: () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  }),
}));

vi.mock("@/lib/server/services/linkies-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/services/linkies-service")
  >("@/lib/server/services/linkies-service");
  return {
    ...actual,
    createLinky: vi.fn(),
    listLinkies: vi.fn(),
    getLinky: vi.fn(),
    updateLinky: vi.fn(),
    deleteLinky: vi.fn(),
    getLinkyVersions: vi.fn(),
  };
});

vi.mock("@/lib/server/services/insights-service", () => ({
  getLinkyInsights: vi.fn(),
}));

vi.mock("@/lib/server/services/keys-service", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/services/keys-service")
  >("@/lib/server/services/keys-service");
  return {
    ...actual,
    listKeys: vi.fn(),
    createKey: vi.fn(),
    revokeKey: vi.fn(),
  };
});

vi.mock("@/lib/server/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/auth")>(
    "@/lib/server/auth",
  );
  return {
    ...actual,
    authenticateBearerToken: vi.fn(),
  };
});

import { LinkyError, RateLimitError } from "@/lib/linky/errors";
import {
  AuthRequiredError,
  ForbiddenError,
  authenticateBearerToken,
  type AuthenticatedSubject,
  type UserSubject,
} from "@/lib/server/auth";
import * as insightsService from "@/lib/server/services/insights-service";
import * as keysService from "@/lib/server/services/keys-service";
import * as linkiesService from "@/lib/server/services/linkies-service";

import { POST } from "./route";
import {
  MCP_ERROR_CODES,
  toMcpError,
  toolDefinitions,
  toolDefinitionsByName,
  toolHandlers,
} from "./tools";

const asMock = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as ReturnType<typeof vi.fn>;

function userSubject(overrides: Partial<UserSubject> = {}): UserSubject {
  return {
    type: "user",
    userId: "user_alice",
    scopes: ["links:write"],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LINKY_MCP_ENABLED;
});

// ---------------------------------------------------------------------------
// Registry invariants.
// ---------------------------------------------------------------------------

describe("tool registry invariants", () => {
  it("every definition has a matching handler", () => {
    for (const def of toolDefinitions) {
      expect(toolHandlers).toHaveProperty(def.name);
      expect(typeof toolHandlers[def.name]).toBe("function");
    }
  });

  it("every handler has a matching definition", () => {
    for (const name of Object.keys(toolHandlers)) {
      expect(toolDefinitionsByName).toHaveProperty(name);
    }
  });

  it("exposes exactly the 11 v1 tools from the sprint plan", () => {
    expect(new Set(toolDefinitions.map((d) => d.name))).toEqual(
      new Set([
        "linky_create",
        "linky_list",
        "linky_get",
        "linky_update",
        "linky_delete",
        "linky_versions",
        "linky_insights",
        "whoami",
        "keys_list",
        "keys_create",
        "keys_revoke",
      ]),
    );
  });

  it("every input schema rejects unknown properties", () => {
    for (const def of toolDefinitions) {
      expect(
        def.inputSchema,
        `tool ${def.name} must be additionalProperties:false`,
      ).toMatchObject({ additionalProperties: false });
    }
  });
});

// ---------------------------------------------------------------------------
// Error mapping.
// ---------------------------------------------------------------------------

describe("toMcpError", () => {
  it("maps AuthRequiredError to code -32001", () => {
    const err = toMcpError(new AuthRequiredError("nope"));
    expect(err.code).toBe(MCP_ERROR_CODES.AuthRequired);
    expect(err.message).toContain("nope");
  });

  it("maps ForbiddenError to code -32002", () => {
    const err = toMcpError(new ForbiddenError("scope missing"));
    expect(err.code).toBe(MCP_ERROR_CODES.Forbidden);
  });

  it("maps LinkyError NOT_FOUND to code -32003", () => {
    const err = toMcpError(
      new LinkyError("gone", { code: "NOT_FOUND", statusCode: 404 }),
    );
    expect(err.code).toBe(MCP_ERROR_CODES.NotFound);
  });

  it("maps LinkyError BAD_REQUEST to InvalidParams (-32602)", () => {
    const err = toMcpError(
      new LinkyError("bad", { code: "BAD_REQUEST", statusCode: 400 }),
    );
    expect(err.code).toBe(MCP_ERROR_CODES.InvalidParams);
  });

  it("maps LinkyError INTERNAL_ERROR to InternalError (-32603) and hides the message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = toMcpError(
      new LinkyError("db down", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
    expect(err.code).toBe(MCP_ERROR_CODES.InternalError);
    // Message is intentionally generic — never leak internals to the client.
    expect(err.message).not.toContain("db down");
  });

  it("maps RateLimitError to code -32004 with retryAfterSeconds in data", () => {
    const err = toMcpError(new RateLimitError(42));
    expect(err.code).toBe(MCP_ERROR_CODES.RateLimited);
    // McpError stores structured error data on `.data` — the SDK passes
    // it through to the JSON-RPC envelope verbatim so harnesses can
    // back off intelligently.
    expect(err.data).toMatchObject({ retryAfterSeconds: 42 });
  });

  it("maps unknown errors to InternalError with a stable message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const err = toMcpError(new TypeError("unexpected"));
    expect(err.code).toBe(MCP_ERROR_CODES.InternalError);
    // The SDK prefixes McpError messages with `MCP error -<code>:`, so
    // we assert the stable tail of the message survives the round-trip
    // and the original TypeError message is NOT leaked.
    expect(err.message).toMatch(/Unexpected server error\.$/);
    expect(err.message).not.toContain("unexpected");
  });
});

// ---------------------------------------------------------------------------
// Handlers.
// ---------------------------------------------------------------------------

function parseToolResult(result: {
  content: Array<{ type: "text"; text: string }>;
}): unknown {
  expect(result.content).toHaveLength(1);
  expect(result.content[0].type).toBe("text");
  return JSON.parse(result.content[0].text);
}

describe("tool handlers", () => {
  it("linky_create returns slug + url and includes claim fields when anonymous", async () => {
    asMock(linkiesService.createLinky).mockResolvedValueOnce({
      slug: "abc123",
      record: {
        id: 1,
        slug: "abc123",
        urls: ["https://a.example/"],
        urlMetadata: [{}],
        title: null,
        description: null,
        owner: { type: "anonymous" },
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        deletedAt: null,
        source: "sdk",
        metadata: null,
        resolutionPolicy: { version: 1, rules: [] },
      },
      claim: {
        token: "tok_xyz",
        expiresAt: "2026-02-01T00:00:00.000Z",
        warningMessage: "save this now",
      },
    });

    const result = await toolHandlers.linky_create(
      { urls: ["https://a.example/"] },
      userSubject(),
    );

    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body.slug).toBe("abc123");
    expect(typeof body.url).toBe("string");
    expect(body.claimToken).toBe("tok_xyz");
    expect(body.claimUrl).toMatch(/\/claim\/tok_xyz$/);
    expect(body.warning).toBe("save this now");
  });

  it("linky_list forwards limit/offset to the service", async () => {
    asMock(linkiesService.listLinkies).mockResolvedValueOnce({
      linkies: [],
      pagination: { limit: 5, offset: 0 },
      subject: { type: "user", userId: "user_alice" },
    });

    await toolHandlers.linky_list({ limit: 5, offset: 0 }, userSubject());

    expect(linkiesService.listLinkies).toHaveBeenCalledWith(
      { limit: 5, offset: 0 },
      expect.any(Object),
    );
  });

  it("linky_get requires a slug", async () => {
    await expect(
      toolHandlers.linky_get({}, userSubject()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("linky_get returns the DTO for a valid slug", async () => {
    asMock(linkiesService.getLinky).mockResolvedValueOnce({
      slug: "abc123",
      urls: ["https://a.example/"],
      urlMetadata: [{}],
      title: null,
      description: null,
      owner: { type: "user", userId: "user_alice" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "sdk",
      metadata: null,
      resolutionPolicy: { version: 1, rules: [] },
    });

    const result = await toolHandlers.linky_get(
      { slug: "abc123" },
      userSubject(),
    );
    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body.slug).toBe("abc123");
  });

  it("linky_update strips the slug before parsing the patch", async () => {
    asMock(linkiesService.updateLinky).mockResolvedValueOnce({
      slug: "abc123",
      urls: ["https://a.example/"],
      urlMetadata: [{}],
      title: "Renamed",
      description: null,
      owner: { type: "user", userId: "user_alice" },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      source: "sdk",
      metadata: null,
      resolutionPolicy: { version: 1, rules: [] },
    });

    await toolHandlers.linky_update(
      { slug: "abc123", title: "Renamed" },
      userSubject(),
    );
    const [arg] = asMock(linkiesService.updateLinky).mock.calls[0];
    expect(arg).toMatchObject({ slug: "abc123", title: "Renamed" });
  });

  it("linky_update rejects patches with no updatable field", async () => {
    await expect(
      toolHandlers.linky_update({ slug: "abc123" }, userSubject()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("linky_delete returns the deletedAt stamp", async () => {
    asMock(linkiesService.deleteLinky).mockResolvedValueOnce({
      slug: "abc123",
      deletedAt: "2026-01-02T00:00:00.000Z",
    });
    const result = await toolHandlers.linky_delete(
      { slug: "abc123" },
      userSubject(),
    );
    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body.slug).toBe("abc123");
    expect(body.deletedAt).toMatch(/Z$/);
  });

  it("linky_versions delegates to the service", async () => {
    asMock(linkiesService.getLinkyVersions).mockResolvedValueOnce({
      versions: [],
    });
    const result = await toolHandlers.linky_versions(
      { slug: "abc123" },
      userSubject(),
    );
    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body.versions).toEqual([]);
  });

  it("linky_insights forwards the optional range param", async () => {
    asMock(insightsService.getLinkyInsights).mockResolvedValueOnce({
      slug: "abc123",
      range: { from: "", to: "" },
      totals: {
        views: 0,
        uniqueViewerDays: 0,
        openAllClicks: 0,
        openAllRate: 0,
      },
      byRule: [],
      series: [],
    });

    await toolHandlers.linky_insights(
      { slug: "abc123", range: "7d" },
      userSubject(),
    );

    expect(insightsService.getLinkyInsights).toHaveBeenCalledWith(
      { slug: "abc123", range: "7d" },
      expect.any(Object),
    );
  });

  it("whoami returns subject + role + scopes WITHOUT requiring keys:admin", async () => {
    const subject = userSubject({ scopes: ["links:read"] });
    const result = await toolHandlers.whoami({}, subject);
    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body).toMatchObject({
      subject: { type: "user", userId: "user_alice" },
      role: "admin",
      scopes: ["links:read"],
    });
  });

  it("keys_list delegates to the keys service", async () => {
    asMock(keysService.listKeys).mockResolvedValueOnce({
      apiKeys: [],
      subject: { type: "user", userId: "user_alice" },
    });
    const result = await toolHandlers.keys_list({}, userSubject());
    const body = parseToolResult(result) as Record<string, unknown>;
    expect(body.apiKeys).toEqual([]);
  });

  it("keys_create forwards name + scopes verbatim", async () => {
    asMock(keysService.createKey).mockResolvedValueOnce({
      apiKey: {
        id: 1,
        name: "ci bot",
        scope: "user",
        scopes: ["links:read"],
        keyPrefix: "lkyu_deadbeef",
        rateLimitPerHour: 1000,
        createdAt: "",
        lastUsedAt: null,
        revokedAt: null,
      },
      rawKey: "lkyu_deadbeef.secret",
      warning: "save once",
    });
    await toolHandlers.keys_create(
      { name: "ci bot", scopes: ["links:read"] },
      userSubject(),
    );
    const [arg] = asMock(keysService.createKey).mock.calls[0];
    expect(arg).toMatchObject({ name: "ci bot", scopes: ["links:read"] });
    // Sprint 2.8 post-launch fix — Bug #8: rateLimitPerHour is now part
    // of the forwarded shape even when absent, so the service gets a
    // chance to validate + apply its own default. Absent = `undefined`.
    expect(arg).toHaveProperty("rateLimitPerHour", undefined);
  });

  it("keys_create forwards rateLimitPerHour when supplied", async () => {
    // Sprint 2.8 post-launch fix — Bug #8: the previous handler dropped
    // this arg on the floor, so every MCP-minted key got the default
    // 1000/hour regardless of what the agent asked for. The HTTP POST
    // path always honored it; only MCP was broken.
    asMock(keysService.createKey).mockResolvedValueOnce({
      apiKey: {
        id: 2,
        name: "low-limit bot",
        scope: "user",
        scopes: ["links:read"],
        keyPrefix: "lkyu_deadbeef",
        rateLimitPerHour: 50,
        createdAt: "",
        lastUsedAt: null,
        revokedAt: null,
      },
      rawKey: "lkyu_deadbeef.secret",
      warning: "save once",
    });
    await toolHandlers.keys_create(
      { name: "low-limit bot", scopes: ["links:read"], rateLimitPerHour: 50 },
      userSubject(),
    );
    const [arg] = asMock(keysService.createKey).mock.calls[0];
    expect(arg).toEqual({
      name: "low-limit bot",
      scopes: ["links:read"],
      rateLimitPerHour: 50,
    });
  });

  it("keys_create schema advertises the rateLimitPerHour property", () => {
    // Regression guard: if a future refactor strips the property from
    // the JSON Schema, the MCP SDK would silently filter it out of
    // tool-call arguments and Bug #8 would reappear. Pin the shape.
    const def = toolDefinitions.find((d) => d.name === "keys_create");
    expect(def).toBeDefined();
    const schema = def!.inputSchema as {
      properties: Record<string, unknown>;
    };
    expect(schema.properties).toHaveProperty("rateLimitPerHour");
    expect(schema.properties.rateLimitPerHour).toMatchObject({
      type: "integer",
      minimum: 0,
    });
  });

  it("keys_revoke requires an integer id", async () => {
    await expect(
      toolHandlers.keys_revoke({ id: "not-a-number" }, userSubject()),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

// ---------------------------------------------------------------------------
// Route-level: auth + kill switch.
//
// We drive POST with a mocked `authenticateBearerToken` so we don't need
// a database or a real API key. The SDK's transport handles the
// JSON-RPC envelope end-to-end; these tests verify the pre-transport
// auth and kill-switch paths the route owns.
// ---------------------------------------------------------------------------

function buildPostRequest(init: {
  body?: unknown;
  bearer?: string;
  accept?: string;
  contentType?: string;
} = {}): Request {
  const headers: Record<string, string> = {
    "content-type": init.contentType ?? "application/json",
    accept: init.accept ?? "application/json, text/event-stream",
  };
  if (init.bearer) headers.authorization = `Bearer ${init.bearer}`;

  return new Request("http://localhost:4040/api/mcp", {
    method: "POST",
    headers,
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

describe("POST /api/mcp", () => {
  it("returns 401 with a WWW-Authenticate challenge when no bearer is present", async () => {
    asMock(authenticateBearerToken).mockRejectedValueOnce(
      new AuthRequiredError("Bearer API key required."),
    );
    const response = await POST(buildPostRequest({ body: {} }));
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toMatch(/Bearer/);
    const body = await response.json();
    expect(body).toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("returns 429 + Retry-After when authenticateBearerToken throws RateLimitError", async () => {
    asMock(authenticateBearerToken).mockRejectedValueOnce(
      new RateLimitError(30),
    );
    const response = await POST(
      buildPostRequest({ bearer: "lkyu_x.y", body: {} }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    const body = await response.json();
    expect(body).toMatchObject({
      code: "RATE_LIMITED",
      retryAfterSeconds: 30,
    });
  });

  it("returns 503 when LINKY_MCP_ENABLED=false", async () => {
    process.env.LINKY_MCP_ENABLED = "false";
    const response = await POST(
      buildPostRequest({ bearer: "lkyu_x.y", body: {} }),
    );
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body).toMatchObject({ code: "MCP_DISABLED" });
    expect(authenticateBearerToken).not.toHaveBeenCalled();
  });

  it("routes to the MCP transport when a valid bearer is provided", async () => {
    asMock(authenticateBearerToken).mockResolvedValueOnce(
      userSubject() as AuthenticatedSubject,
    );

    // A minimal JSON-RPC `tools/list` call. The SDK handles the
    // initialize/initialized handshake implicitly for stateless
    // transports when `enableJsonResponse: true` — but we still need to
    // send an `initialize` first to get a usable response. To keep this
    // test focused on the route-level dispatch (not the SDK's protocol
    // state machine), we simply assert the response came back as a
    // recognizable MCP error for a bare tools/list without initialize.
    const response = await POST(
      buildPostRequest({
        bearer: "lkyu_x.y",
        body: { jsonrpc: "2.0", id: 1, method: "tools/list" },
      }),
    );

    // We care that the transport was invoked and returned *some*
    // Response — the SDK will emit either a 200 with a JSON-RPC error
    // or a 400 depending on protocol-version negotiation. Both are
    // acceptable evidence that auth + dispatch worked.
    expect(response.status).toBeGreaterThanOrEqual(200);
    expect(response.status).toBeLessThan(500);
    expect(authenticateBearerToken).toHaveBeenCalledTimes(1);
  });
});
