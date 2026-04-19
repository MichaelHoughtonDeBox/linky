/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  runList,
  runCreate,
  runRevoke,
  parseScopes,
  parseRateLimit,
} = require("./keys.js");

// ============================================================================
// CLI keys handlers (Sprint 2.8 Chunk C).
//
// Same shape as the linkies test suite: a stub SDK that records calls.
// The parsers (`parseScopes`, `parseRateLimit`) are also tested directly
// so typos and out-of-bound values reject BEFORE we hit the network.
// ============================================================================

function stubClient() {
  return {
    listKeys: vi.fn(async () => ({
      apiKeys: [],
      subject: { type: "user", userId: "user_alice" },
    })),
    createKey: vi.fn(async ({ name, scopes, rateLimitPerHour }) => ({
      apiKey: {
        id: 1,
        name,
        scope: "user",
        scopes: scopes ?? ["links:write"],
        keyPrefix: "lkyu_deadbeef",
        rateLimitPerHour: rateLimitPerHour ?? 1000,
        createdAt: "2026-01-01T00:00:00.000Z",
        lastUsedAt: null,
        revokedAt: null,
      },
      rawKey: "lkyu_deadbeef.the-raw-secret-value",
      warning: "save once",
    })),
    revokeKey: vi.fn(async (id) => ({
      apiKey: { id, revokedAt: "2026-01-02T00:00:00.000Z" },
    })),
  };
}

function stubSdk(client) {
  return {
    LinkyClient: vi.fn(function Ctor() {
      return client;
    }),
  };
}

let stdoutSpy;
beforeEach(() => {
  stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  stdoutSpy.mockRestore();
});

describe("parseScopes", () => {
  it("returns undefined for missing input", () => {
    expect(parseScopes(undefined)).toBeUndefined();
    expect(parseScopes("")).toBeUndefined();
  });

  it("splits + trims comma-separated scopes", () => {
    expect(parseScopes("links:read,links:write")).toEqual([
      "links:read",
      "links:write",
    ]);
    expect(parseScopes("  keys:admin  ")).toEqual(["keys:admin"]);
  });

  it("rejects unknown scope strings with an allowed-list message", () => {
    expect(() => parseScopes("link:read")).toThrow(/Allowed:/);
  });
});

describe("parseRateLimit", () => {
  it("returns undefined when absent", () => {
    expect(parseRateLimit(undefined)).toBeUndefined();
    expect(parseRateLimit(null)).toBeUndefined();
  });

  it("accepts integer strings including 0", () => {
    expect(parseRateLimit("0")).toBe(0);
    expect(parseRateLimit("1000")).toBe(1000);
  });

  it("rejects negatives + overcaps + garbage", () => {
    expect(() => parseRateLimit("-5")).toThrow();
    expect(() => parseRateLimit("9999999")).toThrow();
    expect(() => parseRateLimit("many")).toThrow();
  });
});

describe("runList", () => {
  it("delegates to listKeys", async () => {
    const client = stubClient();
    await runList([], stubSdk(client));
    expect(client.listKeys).toHaveBeenCalledTimes(1);
  });
});

describe("runCreate", () => {
  it("requires a name", async () => {
    await expect(runCreate([], stubSdk(stubClient()))).rejects.toThrow(
      /name/,
    );
  });

  it("forwards --scopes and --rate-limit verbatim", async () => {
    const client = stubClient();
    await runCreate(
      ["ci bot", "--scopes", "links:read", "--rate-limit", "500"],
      stubSdk(client),
    );
    expect(client.createKey).toHaveBeenCalledWith({
      name: "ci bot",
      scopes: ["links:read"],
      rateLimitPerHour: 500,
    });
  });

  it("prints the raw key exactly once", async () => {
    const client = stubClient();
    await runCreate(["ci bot"], stubSdk(client));
    const output = stdoutSpy.mock.calls.flat().join("\n");
    expect(output).toContain("lkyu_deadbeef.the-raw-secret-value");
    // Warning text must surface too — it's the "shown once" notice.
    expect(output).toContain("save once");
  });
});

describe("runRevoke", () => {
  it("requires a positive integer id", async () => {
    await expect(runRevoke(["not-a-number"], stubSdk(stubClient()))).rejects.toThrow();
    await expect(runRevoke([], stubSdk(stubClient()))).rejects.toThrow(/id/);
  });

  it("calls revokeKey with the parsed id", async () => {
    const client = stubClient();
    await runRevoke(["42"], stubSdk(client));
    expect(client.revokeKey).toHaveBeenCalledWith(42);
  });
});
