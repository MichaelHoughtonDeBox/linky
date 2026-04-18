import { describe, expect, it } from "vitest";

import {
  computeViewerHashDay,
  resolveInsightsRange,
  resolveSubjectKey,
  todayUtcYyyyMmDd,
} from "./launcher-events-repository";

// ============================================================================
// Pure-helper tests. The DB insert path is exercised against a real Neon in
// the staging / production rollout — not unit tests. These tests protect the
// two invariants that cannot drift without breaking the trust posture:
//
//   1. Same subject + same day + same salt → same hash.
//   2. Different day OR different salt → different hash.
//
// If either invariant fails, "unique viewers per day" stops being meaningful.
// ============================================================================

const SALT = "a".repeat(32);

describe("computeViewerHashDay", () => {
  it("produces a stable 32-char hex string", () => {
    const hash = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    expect(hash).toMatch(/^[0-9a-f]{32}$/);
  });

  it("is deterministic for the same inputs", () => {
    const a = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    const b = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    expect(a).toBe(b);
  });

  it("changes when the date rolls over", () => {
    const today = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    const tomorrow = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-19",
      salt: SALT,
    });
    expect(today).not.toBe(tomorrow);
  });

  it("changes when the salt rotates", () => {
    const a = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: "a".repeat(32),
    });
    const b = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: "b".repeat(32),
    });
    expect(a).not.toBe(b);
  });

  it("distinguishes anonymous IP-bucketed viewers from signed-in users", () => {
    const signedIn = computeViewerHashDay({
      subjectKey: "u:user_123",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    const anonymous = computeViewerHashDay({
      subjectKey: "ip:v4:1.2.3.0",
      dateYyyyMmDd: "2026-04-18",
      salt: SALT,
    });
    expect(signedIn).not.toBe(anonymous);
  });
});

describe("todayUtcYyyyMmDd", () => {
  it("returns the UTC day in YYYY-MM-DD format", () => {
    // Pin to 2026-04-18T23:30:00Z — close to a day boundary but still UTC 18th.
    const pinned = new Date(Date.UTC(2026, 3, 18, 23, 30, 0));
    expect(todayUtcYyyyMmDd(pinned)).toBe("2026-04-18");
  });

  it("rolls over at UTC midnight", () => {
    const before = new Date(Date.UTC(2026, 3, 18, 23, 59, 59, 500));
    const after = new Date(Date.UTC(2026, 3, 19, 0, 0, 0, 500));
    expect(todayUtcYyyyMmDd(before)).toBe("2026-04-18");
    expect(todayUtcYyyyMmDd(after)).toBe("2026-04-19");
  });
});

describe("resolveSubjectKey", () => {
  it("prefers clerk user id when present", () => {
    const out = resolveSubjectKey({
      clerkUserId: "user_abc",
      clientIp: "1.2.3.4",
    });
    expect(out.viewerState).toBe("signed_in");
    expect(out.subjectKey).toBe("u:user_abc");
  });

  it("falls back to /24 IP subnet for anonymous viewers", () => {
    const out = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "192.168.1.42",
    });
    expect(out.viewerState).toBe("anonymous");
    expect(out.subjectKey).toBe("ip:v4:192.168.1.0");
  });

  it("collapses devices on the same /24 into one subject", () => {
    // Two different laptops, same office → same subject key. Intentional:
    // we're counting viewers, not devices, and /24 is the coarsest signal
    // that's still granular enough to be useful in an office / ISP setting.
    const laptopA = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "192.168.1.10",
    });
    const laptopB = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "192.168.1.250",
    });
    expect(laptopA.subjectKey).toBe(laptopB.subjectKey);
  });

  it("distinguishes different /24s", () => {
    const a = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "192.168.1.10",
    });
    const b = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "192.168.2.10",
    });
    expect(a.subjectKey).not.toBe(b.subjectKey);
  });

  it("buckets IPv6 to the /48 prefix", () => {
    const out = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "2001:db8:1234:5678::1",
    });
    expect(out.viewerState).toBe("anonymous");
    expect(out.subjectKey).toBe("ip:v6:2001:db8:1234");
  });

  it("handles an unknown client IP without throwing", () => {
    const out = resolveSubjectKey({
      clerkUserId: null,
      clientIp: "unknown",
    });
    expect(out.viewerState).toBe("anonymous");
    expect(out.subjectKey).toBe("ip:unknown");
  });
});

describe("resolveInsightsRange", () => {
  it("accepts the three valid ranges verbatim", () => {
    expect(resolveInsightsRange("7d")).toBe("7d");
    expect(resolveInsightsRange("30d")).toBe("30d");
    expect(resolveInsightsRange("90d")).toBe("90d");
  });

  it("defaults to 30d for null / undefined / invalid input", () => {
    expect(resolveInsightsRange(null)).toBe("30d");
    expect(resolveInsightsRange(undefined)).toBe("30d");
    expect(resolveInsightsRange("365d")).toBe("30d");
    expect(resolveInsightsRange("garbage")).toBe("30d");
    // Chunk B intentionally caps at 90d; paid-plan retention
    // extensions can widen this later without a breaking change.
    expect(resolveInsightsRange("180d")).toBe("30d");
  });
});
