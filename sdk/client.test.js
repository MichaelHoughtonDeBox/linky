import { describe, expect, it, vi } from "vitest";
import { LinkyApiError, LinkyClient } from "./client.js";

// ============================================================================
// LinkyClient unit tests — Sprint 2.8 Chunk 0.
//
// All tests mock `fetchImpl`, so no network / server / DB is required. The
// assertions verify the wire contract: URL, method, headers, and JSON
// body. That's the public contract between this SDK and the HTTP routes
// under `src/app/api/*`.
//
// If the server's error envelope shape ever changes (`{ error, code,
// details }`), this file is the place where that drift will fail loudly
// — the error-mapping test below pins every field.
// ============================================================================

function okResponse(data = {}, init = {}) {
  return {
    ok: true,
    status: init.status ?? 200,
    json: async () => data,
  };
}

function errResponse(data, status) {
  return {
    ok: false,
    status,
    json: async () => data,
  };
}

function makeFetchSpy(responder) {
  return vi.fn(async (url, options) => responder(url, options));
}

describe("LinkyClient constructor", () => {
  it("falls back to DEFAULT_BASE_URL when none is provided", () => {
    const client = new LinkyClient({ fetchImpl: () => {} });
    expect(client.baseUrl).toBeTypeOf("string");
    expect(client.baseUrl.startsWith("http")).toBe(true);
  });

  it("throws when no fetchImpl is available", () => {
    const originalFetch = globalThis.fetch;
    // Force the "no fetch" path by deleting the global.
    delete globalThis.fetch;
    try {
      expect(() => new LinkyClient({})).toThrow(/fetch/);
    } finally {
      if (originalFetch) globalThis.fetch = originalFetch;
    }
  });
});

describe("LinkyClient.createLinky", () => {
  it("POSTs to /api/links with the JSON body and Linky-Client header", async () => {
    const spy = makeFetchSpy(() =>
      okResponse({ slug: "abc123", url: "https://example/l/abc123" }, { status: 201 }),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      fetchImpl: spy,
      client: "cursor/skill-v1",
    });

    const result = await client.createLinky({
      urls: ["https://a.example", "https://b.example"],
      title: "My Bundle",
    });

    expect(result).toEqual({
      slug: "abc123",
      url: "https://example/l/abc123",
    });

    const [url, options] = spy.mock.calls[0];
    expect(url).toBe("https://linky.example/api/links");
    expect(options.method).toBe("POST");
    expect(options.headers["content-type"]).toBe("application/json");
    expect(options.headers["Linky-Client"]).toBe("cursor/skill-v1");
    // Anonymous create → no Authorization header.
    expect(options.headers.authorization).toBeUndefined();

    const body = JSON.parse(options.body);
    expect(body.urls).toEqual(["https://a.example", "https://b.example"]);
    expect(body.source).toBe("sdk");
    expect(body.title).toBe("My Bundle");
  });

  it("rejects empty URL arrays before hitting the network", async () => {
    const spy = makeFetchSpy(() => okResponse({}));
    const client = new LinkyClient({ fetchImpl: spy });

    await expect(client.createLinky({ urls: [] })).rejects.toThrow(
      /non-empty array/,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("LinkyClient.listLinkies", () => {
  it("sends limit + offset as query params and a bearer token", async () => {
    const spy = makeFetchSpy(() =>
      okResponse({ linkies: [], pagination: { limit: 20, offset: 0 } }),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_deadbeef.secret",
      fetchImpl: spy,
    });

    await client.listLinkies({ limit: 10, offset: 5 });

    const [url, options] = spy.mock.calls[0];
    expect(url).toBe("https://linky.example/api/me/links?limit=10&offset=5");
    expect(options.method).toBe("GET");
    expect(options.headers.authorization).toBe("Bearer lkyu_deadbeef.secret");
  });
});

describe("LinkyClient.updateLinky", () => {
  it("PATCHes /api/links/:slug with the patch body", async () => {
    const spy = makeFetchSpy(() =>
      okResponse({ linky: { slug: "abc123", urls: ["https://x.example"] } }),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });

    const result = await client.updateLinky("abc123", {
      title: "Renamed",
    });

    expect(result.linky.slug).toBe("abc123");

    const [url, options] = spy.mock.calls[0];
    expect(url).toBe("https://linky.example/api/links/abc123");
    expect(options.method).toBe("PATCH");
    const body = JSON.parse(options.body);
    expect(body.title).toBe("Renamed");
  });

  it("rejects empty patches before hitting the network", async () => {
    const spy = makeFetchSpy(() => okResponse({}));
    const client = new LinkyClient({ fetchImpl: spy });

    await expect(client.updateLinky("abc123", {})).rejects.toThrow(
      /at least one update field/,
    );
    expect(spy).not.toHaveBeenCalled();
  });

  it("rejects bad slugs early", async () => {
    const spy = makeFetchSpy(() => okResponse({}));
    const client = new LinkyClient({ fetchImpl: spy });

    await expect(client.updateLinky("", { title: "x" })).rejects.toThrow(
      /slug/,
    );
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("LinkyClient.deleteLinky", () => {
  it("DELETEs /api/links/:slug", async () => {
    const spy = makeFetchSpy(() => okResponse({ ok: true }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });

    await client.deleteLinky("abc123");

    const [url, options] = spy.mock.calls[0];
    expect(url).toBe("https://linky.example/api/links/abc123");
    expect(options.method).toBe("DELETE");
  });
});

describe("LinkyClient.getVersions / getInsights / getLinky", () => {
  it("GETs versions", async () => {
    const spy = makeFetchSpy(() => okResponse({ versions: [] }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });
    await client.getVersions("abc123");
    expect(spy.mock.calls[0][0]).toBe(
      "https://linky.example/api/links/abc123/versions",
    );
  });

  it("GETs insights with the range param", async () => {
    const spy = makeFetchSpy(() =>
      okResponse({ slug: "abc", range: {}, totals: {}, byRule: [], series: [] }),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });
    await client.getInsights("abc123", { range: "30d" });
    expect(spy.mock.calls[0][0]).toBe(
      "https://linky.example/api/links/abc123/insights?range=30d",
    );
  });

  it("getLinky targets /api/links/:slug", async () => {
    const spy = makeFetchSpy(() => okResponse({ slug: "abc" }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      fetchImpl: spy,
    });
    await client.getLinky("abc123");
    expect(spy.mock.calls[0][0]).toBe(
      "https://linky.example/api/links/abc123",
    );
  });
});

describe("LinkyClient keys surface", () => {
  it("listKeys + whoami both hit GET /api/me/keys", async () => {
    const spy = makeFetchSpy(() => okResponse({ apiKeys: [], subject: {} }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });
    await client.listKeys();
    await client.whoami();
    expect(spy).toHaveBeenCalledTimes(2);
    for (const call of spy.mock.calls) {
      expect(call[0]).toBe("https://linky.example/api/me/keys");
      expect(call[1].method).toBe("GET");
    }
  });

  it("createKey POSTs the normalized body", async () => {
    const spy = makeFetchSpy(() =>
      okResponse({ apiKey: {}, rawKey: "lkyu_x.y", warning: "..." }),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });
    await client.createKey({ name: "ci bot", scopes: ["links:read"] });
    const body = JSON.parse(spy.mock.calls[0][1].body);
    expect(body).toEqual({ name: "ci bot", scopes: ["links:read"] });
  });

  it("revokeKey DELETEs /api/me/keys?id=N", async () => {
    const spy = makeFetchSpy(() => okResponse({ apiKey: {} }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });
    await client.revokeKey(42);
    expect(spy.mock.calls[0][0]).toBe(
      "https://linky.example/api/me/keys?id=42",
    );
    expect(spy.mock.calls[0][1].method).toBe("DELETE");
  });

  it("revokeKey rejects bad ids before the network call", async () => {
    const spy = makeFetchSpy(() => okResponse({}));
    const client = new LinkyClient({ fetchImpl: spy });
    await expect(client.revokeKey(-1)).rejects.toThrow(/positive integer/);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("LinkyClient error handling", () => {
  it("throws a LinkyApiError with the server's error envelope", async () => {
    const spy = makeFetchSpy(() =>
      errResponse(
        {
          error: "This API key does not carry the 'links:write' scope.",
          code: "FORBIDDEN",
          details: { required: "links:write" },
        },
        403,
      ),
    );
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      apiKey: "lkyu_abc.secret",
      fetchImpl: spy,
    });

    let caught;
    try {
      await client.deleteLinky("abc123");
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(LinkyApiError);
    expect(caught.code).toBe("FORBIDDEN");
    expect(caught.statusCode).toBe(403);
    expect(caught.message).toMatch(/links:write/);
    expect(caught.details).toEqual({ required: "links:write" });
  });

  it("falls back to a generic message when the server returns no body", async () => {
    const spy = makeFetchSpy(() => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    }));
    const client = new LinkyClient({
      baseUrl: "https://linky.example",
      fetchImpl: spy,
    });

    await expect(
      client.createLinky({ urls: ["https://a.example"] }),
    ).rejects.toMatchObject({ statusCode: 502, code: "UNKNOWN_ERROR" });
  });
});
