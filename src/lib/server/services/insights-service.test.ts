import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/postgres", () => ({
  getPgPool: () => ({
    query: async () => ({ rows: [], rowCount: 0 }),
    connect: async () => ({
      query: async () => ({ rows: [], rowCount: 0 }),
      release: () => {},
    }),
  }),
}));

vi.mock("@/lib/server/linkies-repository", () => ({
  getLinkyRecordBySlug: vi.fn(),
}));

vi.mock("@/lib/server/launcher-events-repository", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/server/launcher-events-repository")
  >("@/lib/server/launcher-events-repository");
  return {
    ...actual,
    aggregateLauncherInsights: vi.fn(),
  };
});

import type { LinkyRecord } from "@/lib/linky/types";
import type { UserSubject } from "@/lib/server/auth";
import * as events from "@/lib/server/launcher-events-repository";
import * as repo from "@/lib/server/linkies-repository";

import { getLinkyInsights } from "./insights-service";

const asMock = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as ReturnType<typeof vi.fn>;

function userSubject(overrides: Partial<UserSubject> = {}): UserSubject {
  return { type: "user", userId: "user_alice", ...overrides };
}

function linkyRecord(overrides: Partial<LinkyRecord> = {}): LinkyRecord {
  return {
    id: 42,
    slug: "abc123",
    urls: ["https://a.example/"],
    urlMetadata: [{}],
    title: null,
    description: null,
    owner: { type: "user", userId: "user_alice" },
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    deletedAt: null,
    source: "sdk",
    metadata: null,
    resolutionPolicy: {
      version: 1,
      rules: [
        {
          id: "rule_deadbeef_cafef00d",
          name: "Acme teammates",
          when: { op: "always" },
          tabs: [{ url: "https://a.example/" }],
          stopOnMatch: true,
          showBadge: false,
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getLinkyInsights", () => {
  it("returns totals, byRule with names, and series", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());
    asMock(events.aggregateLauncherInsights).mockResolvedValueOnce({
      range: { from: "2026-01-01T00:00:00Z", to: "2026-01-31T00:00:00Z" },
      totals: {
        views: 10,
        uniqueViewerDays: 7,
        openAllClicks: 3,
        openAllRate: 0.3,
      },
      byRule: [
        { ruleId: "rule_deadbeef_cafef00d", views: 7, openAllClicks: 2, openAllRate: 0.286 },
        { ruleId: null, views: 3, openAllClicks: 1, openAllRate: 0.333 },
      ],
      series: [
        { day: "2026-01-01", views: 4, openAllClicks: 1 },
        { day: "2026-01-02", views: 6, openAllClicks: 2 },
      ],
    });

    const dto = await getLinkyInsights(
      { slug: "abc123", range: "30d" },
      userSubject(),
    );

    expect(dto.slug).toBe("abc123");
    expect(dto.totals.views).toBe(10);
    expect(dto.byRule).toEqual([
      {
        ruleId: "rule_deadbeef_cafef00d",
        views: 7,
        openAllClicks: 2,
        openAllRate: 0.286,
        ruleName: "Acme teammates",
      },
      {
        ruleId: null,
        views: 3,
        openAllClicks: 1,
        openAllRate: 0.333,
        ruleName: "Fallthrough",
      },
    ]);
    expect(dto.series).toHaveLength(2);
  });

  it("renders dangling rule ids as '(removed rule)'", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(
      linkyRecord({ resolutionPolicy: { version: 1, rules: [] } }),
    );
    asMock(events.aggregateLauncherInsights).mockResolvedValueOnce({
      range: { from: "2026-01-01T00:00:00Z", to: "2026-01-31T00:00:00Z" },
      totals: { views: 1, uniqueViewerDays: 1, openAllClicks: 0, openAllRate: 0 },
      byRule: [
        { ruleId: "rule_removed", views: 1, openAllClicks: 0, openAllRate: 0 },
      ],
      series: [],
    });

    const dto = await getLinkyInsights(
      { slug: "abc123", range: "7d" },
      userSubject(),
    );

    expect(dto.byRule[0].ruleName).toBe("(removed rule)");
  });

  it("404s on a missing slug", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(null);

    await expect(
      getLinkyInsights({ slug: "nope" }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("403s on a non-owner user", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(
      linkyRecord({ owner: { type: "user", userId: "user_bob" } }),
    );

    await expect(
      getLinkyInsights({ slug: "abc123" }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects a links:read key without the scope", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());

    await expect(
      getLinkyInsights(
        { slug: "abc123" },
        userSubject({ scopes: [] as unknown as ["links:read"] }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
