import { describe, expect, it } from "vitest";

import {
  expandScopes,
  normalizeScopes,
  parseScopesInput,
  type ApiKeyPermission,
} from "./api-keys";
import {
  subjectHasScope,
  requireScope,
  ForbiddenError,
  type AuthSubject,
} from "./auth";

// ============================================================================
// Scope invariants for Sprint 2.7 Chunk D.
//
// These tests lock the allow-list, the implication rules, and the mint-time
// rejection behavior. Any regression here would either silently downgrade a
// key (normalizing 'link:read' to nothing at mint time, for example) or
// silently upgrade one (implying 'keys:admin' from 'links:write').
// ============================================================================

describe("normalizeScopes", () => {
  it("returns an empty array for non-array input", () => {
    expect(normalizeScopes(null)).toEqual([]);
    expect(normalizeScopes(undefined)).toEqual([]);
    expect(normalizeScopes("links:read")).toEqual([]);
    expect(normalizeScopes({})).toEqual([]);
  });

  it("filters unknown entries silently on READ", () => {
    // Silent filter on read is intentional: a bad row in the DB should
    // not brick authentication. Bad input at MINT is a hard reject —
    // that's parseScopesInput's job.
    expect(normalizeScopes(["links:read", "bogus"])).toEqual(["links:read"]);
    expect(normalizeScopes(["link:read"])).toEqual([]);
  });

  it("dedupes repeat entries", () => {
    expect(normalizeScopes(["links:read", "links:read"])).toEqual(["links:read"]);
  });

  it("accepts every entry from the allow-list", () => {
    const all: ApiKeyPermission[] = ["links:read", "links:write", "keys:admin"];
    expect(normalizeScopes(all).sort()).toEqual(all.sort());
  });
});

describe("expandScopes", () => {
  it("expands write -> read", () => {
    const out = expandScopes(["links:write"]);
    expect(out.has("links:read")).toBe(true);
    expect(out.has("links:write")).toBe(true);
    expect(out.has("keys:admin")).toBe(false);
  });

  it("expands keys:admin -> links:read + links:write", () => {
    const out = expandScopes(["keys:admin"]);
    expect(out.has("links:read")).toBe(true);
    expect(out.has("links:write")).toBe(true);
    expect(out.has("keys:admin")).toBe(true);
  });

  it("does NOT downgrade (read does not imply write)", () => {
    const out = expandScopes(["links:read"]);
    expect(out.has("links:read")).toBe(true);
    expect(out.has("links:write")).toBe(false);
    expect(out.has("keys:admin")).toBe(false);
  });

  it("composes multiple scopes idempotently", () => {
    const out = expandScopes(["links:read", "links:write"]);
    expect(out.has("links:read")).toBe(true);
    expect(out.has("links:write")).toBe(true);
    expect(out.has("keys:admin")).toBe(false);
  });

  it("returns an empty set for an empty input", () => {
    expect(expandScopes([]).size).toBe(0);
  });
});

describe("parseScopesInput (mint-time validation)", () => {
  it("defaults missing input to ['links:write'] to preserve Sprint 2.6 behavior", () => {
    expect(parseScopesInput(undefined)).toEqual(["links:write"]);
  });

  it("accepts the three allow-list values", () => {
    expect(parseScopesInput(["links:read"])).toEqual(["links:read"]);
    expect(parseScopesInput(["links:write"])).toEqual(["links:write"]);
    expect(parseScopesInput(["keys:admin"])).toEqual(["keys:admin"]);
  });

  it("dedupes while preserving order of first appearance", () => {
    const out = parseScopesInput(["links:read", "links:write", "links:read"]);
    expect(out).toEqual(["links:read", "links:write"]);
  });

  it("rejects an empty array — a key with zero capability is a footgun", () => {
    expect(() => parseScopesInput([])).toThrow(/non-empty array/);
  });

  it("rejects a non-array payload", () => {
    expect(() => parseScopesInput("links:read")).toThrow(/non-empty array/);
    expect(() => parseScopesInput({ scopes: ["links:read"] })).toThrow(
      /non-empty array/,
    );
  });

  it("rejects unknown scope strings with an actionable message", () => {
    expect(() => parseScopesInput(["link:read"])).toThrow(/Unknown scope/);
    expect(() => parseScopesInput(["links:write", "bogus"])).toThrow(
      /Unknown scope/,
    );
  });
});

// ---------------------------------------------------------------------------
// subjectHasScope / requireScope — gate behavior from the auth layer.
// ---------------------------------------------------------------------------

const SESSION_USER: AuthSubject = { type: "user", userId: "user_A" };
const SESSION_ORG_ADMIN: AuthSubject = {
  type: "org",
  orgId: "org_X",
  userId: "user_A",
  role: "org:admin",
};
const BEARER_USER_READ: AuthSubject = {
  type: "user",
  userId: "user_A",
  scopes: ["links:read"],
};
const BEARER_USER_WRITE: AuthSubject = {
  type: "user",
  userId: "user_A",
  scopes: ["links:write"],
};
const BEARER_USER_ADMIN: AuthSubject = {
  type: "user",
  userId: "user_A",
  scopes: ["keys:admin"],
};
const BEARER_ORG_READ: AuthSubject = {
  type: "org",
  orgId: "org_X",
  userId: null,
  role: null,
  scopes: ["links:read"],
};
const ANONYMOUS: AuthSubject = { type: "anonymous" };

describe("subjectHasScope", () => {
  it("returns true for any scope on session subjects (no key = no scope cap)", () => {
    expect(subjectHasScope(SESSION_USER, "links:read")).toBe(true);
    expect(subjectHasScope(SESSION_USER, "links:write")).toBe(true);
    expect(subjectHasScope(SESSION_USER, "keys:admin")).toBe(true);

    expect(subjectHasScope(SESSION_ORG_ADMIN, "keys:admin")).toBe(true);
  });

  it("returns false for any scope on anonymous subjects", () => {
    expect(subjectHasScope(ANONYMOUS, "links:read")).toBe(false);
    expect(subjectHasScope(ANONYMOUS, "links:write")).toBe(false);
    expect(subjectHasScope(ANONYMOUS, "keys:admin")).toBe(false);
  });

  it("honors implication for links:write and keys:admin", () => {
    expect(subjectHasScope(BEARER_USER_WRITE, "links:read")).toBe(true);
    expect(subjectHasScope(BEARER_USER_WRITE, "links:write")).toBe(true);
    expect(subjectHasScope(BEARER_USER_WRITE, "keys:admin")).toBe(false);

    expect(subjectHasScope(BEARER_USER_ADMIN, "links:read")).toBe(true);
    expect(subjectHasScope(BEARER_USER_ADMIN, "links:write")).toBe(true);
    expect(subjectHasScope(BEARER_USER_ADMIN, "keys:admin")).toBe(true);
  });

  it("denies writes and admin to a read-only key", () => {
    expect(subjectHasScope(BEARER_USER_READ, "links:read")).toBe(true);
    expect(subjectHasScope(BEARER_USER_READ, "links:write")).toBe(false);
    expect(subjectHasScope(BEARER_USER_READ, "keys:admin")).toBe(false);

    expect(subjectHasScope(BEARER_ORG_READ, "links:read")).toBe(true);
    expect(subjectHasScope(BEARER_ORG_READ, "links:write")).toBe(false);
  });
});

describe("requireScope", () => {
  it("does not throw when the scope is satisfied", () => {
    expect(() => requireScope(BEARER_USER_READ, "links:read")).not.toThrow();
    expect(() => requireScope(BEARER_USER_WRITE, "links:read")).not.toThrow();
    expect(() => requireScope(SESSION_USER, "keys:admin")).not.toThrow();
  });

  it("throws ForbiddenError with a scope-named message on denial", () => {
    try {
      requireScope(BEARER_USER_READ, "links:write");
      expect.fail("requireScope should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenError);
      expect((error as ForbiddenError).message).toContain("links:write");
    }
  });
});
