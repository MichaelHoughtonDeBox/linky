/* eslint-disable @typescript-eslint/no-require-imports */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  runList,
  runGet,
  runHistory,
  runInsights,
  runDelete,
} = require("./linkies.js");

// ============================================================================
// CLI linkies handlers (Sprint 2.8 Chunk C).
//
// Each handler receives a mocked `sdk` that emulates the top-level
// package entry (exports `LinkyClient`). The client itself is a stub
// that records calls + returns canned responses. That way we verify:
//
//   - URL / method / arg forwarding into LinkyClient methods.
//   - --json short-circuits the pretty renderer.
//   - Bad flags and missing slugs throw before any network call.
//   - `linky delete` without --force is a silent no-op (no client call).
// ============================================================================

function stubClient() {
  const calls = [];
  return {
    calls,
    listLinkies: vi.fn(async (params) => {
      calls.push(["listLinkies", params]);
      return { linkies: [], pagination: { limit: 20, offset: 0 } };
    }),
    getLinky: vi.fn(async (slug) => {
      calls.push(["getLinky", slug]);
      return {
        slug,
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
      };
    }),
    getVersions: vi.fn(async (slug) => {
      calls.push(["getVersions", slug]);
      return { versions: [] };
    }),
    getInsights: vi.fn(async (slug, params) => {
      calls.push(["getInsights", slug, params]);
      return {
        slug,
        range: { from: "2026-01-01T00:00:00Z", to: "2026-01-31T00:00:00Z" },
        totals: {
          views: 0,
          uniqueViewerDays: 0,
          openAllClicks: 0,
          openAllRate: 0,
        },
        byRule: [],
        series: [],
      };
    }),
    deleteLinky: vi.fn(async (slug) => {
      calls.push(["deleteLinky", slug]);
      return { ok: true };
    }),
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
let stderrSpy;

beforeEach(() => {
  stdoutSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  stderrSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  stdoutSpy.mockRestore();
  stderrSpy.mockRestore();
});

describe("runList", () => {
  it("forwards --limit and --offset to listLinkies", async () => {
    const client = stubClient();
    await runList(["--limit", "10", "--offset", "5"], stubSdk(client));
    expect(client.listLinkies).toHaveBeenCalledWith({ limit: 10, offset: 5 });
  });

  it("--json prints the response body verbatim", async () => {
    const client = stubClient();
    client.listLinkies.mockResolvedValueOnce({
      linkies: [{ slug: "abc123", urls: [] }],
      pagination: { limit: 20, offset: 0 },
    });
    await runList(["--json"], stubSdk(client));
    expect(stdoutSpy).toHaveBeenCalledWith(
      expect.stringContaining('"slug":"abc123"'),
    );
  });

  it("rejects unknown flags", async () => {
    await expect(runList(["--bogus"], stubSdk(stubClient()))).rejects.toThrow(
      /Unknown option/,
    );
  });
});

describe("runGet", () => {
  it("requires a slug argument", async () => {
    await expect(runGet([], stubSdk(stubClient()))).rejects.toThrow(/slug/);
  });

  it("calls getLinky with the slug", async () => {
    const client = stubClient();
    await runGet(["abc123"], stubSdk(client));
    expect(client.getLinky).toHaveBeenCalledWith("abc123");
  });

  it("--json short-circuits the pretty renderer", async () => {
    const client = stubClient();
    await runGet(["abc123", "--json"], stubSdk(client));
    const out = stdoutSpy.mock.calls.flat().join("\n");
    expect(out).toContain('"slug":"abc123"');
  });
});

describe("runHistory", () => {
  it("delegates to getVersions", async () => {
    const client = stubClient();
    await runHistory(["abc123"], stubSdk(client));
    expect(client.getVersions).toHaveBeenCalledWith("abc123");
  });
});

describe("runInsights", () => {
  it("forwards --range", async () => {
    const client = stubClient();
    await runInsights(["abc123", "--range", "7d"], stubSdk(client));
    expect(client.getInsights).toHaveBeenCalledWith("abc123", { range: "7d" });
  });

  it("rejects invalid --range values before hitting the network", async () => {
    const client = stubClient();
    await expect(
      runInsights(["abc123", "--range", "1y"], stubSdk(client)),
    ).rejects.toThrow(/--range/);
    expect(client.getInsights).not.toHaveBeenCalled();
  });
});

describe("runDelete", () => {
  it("without --force is a silent no-op (no network call)", async () => {
    const client = stubClient();
    await runDelete(["abc123"], stubSdk(client));
    expect(client.deleteLinky).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalledWith(expect.stringMatching(/--force/));
  });

  it("with --force soft-deletes via the client", async () => {
    const client = stubClient();
    await runDelete(["abc123", "--force"], stubSdk(client));
    expect(client.deleteLinky).toHaveBeenCalledWith("abc123");
  });
});
