import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// Linkies service tests — Sprint 2.8 Chunk 0.
//
// We mock the repository boundary so the service's DB-facing helpers
// (`insertLinkyRecord`, `getLinkyRecordBySlug`, …) return deterministic
// fixtures. That lets every assertion target the pure service logic:
//
//   - scope gating (`requireScope`)
//   - role/ownership gating (`requireCan*Linky`)
//   - DTO shaping + claim-token minting
//   - NOT_FOUND surfacing for PATCH / DELETE / versions
//
// Integration-level parity with the HTTP routes is implicit: the routes
// are now thin wrappers that only delegate to these functions. If a
// service test passes, the route can't regress without a typecheck
// failure.
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

vi.mock("@/lib/server/linkies-repository", () => ({
  insertLinkyRecord: vi.fn(),
  getLinkyRecordBySlug: vi.fn(),
  listLinkiesForSubject: vi.fn(),
  patchLinkyRecord: vi.fn(),
  softDeleteLinkyRecord: vi.fn(),
  listLinkyVersions: vi.fn(),
}));

vi.mock("@/lib/server/claim-tokens", () => ({
  createClaimToken: vi.fn(),
}));

import type { LinkyRecord } from "@/lib/linky/types";
import type {
  AnonymousSubject,
  AuthenticatedSubject,
  OrgSubject,
  UserSubject,
} from "@/lib/server/auth";
import * as claimTokens from "@/lib/server/claim-tokens";
import * as repo from "@/lib/server/linkies-repository";

import {
  createLinky,
  deleteLinky,
  getLinky,
  getLinkyVersions,
  listLinkies,
  parseListPagination,
  updateLinky,
} from "./linkies-service";

const asMock = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

function userSubject(
  overrides: Partial<UserSubject> = {},
): UserSubject {
  return { type: "user", userId: "user_alice", ...overrides };
}

function orgSubject(overrides: Partial<OrgSubject> = {}): OrgSubject {
  return {
    type: "org",
    orgId: "org_acme",
    userId: "user_alice",
    role: "org:admin",
    ...overrides,
  };
}

function anonymousSubject(): AnonymousSubject {
  return { type: "anonymous" };
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
    resolutionPolicy: { version: 1, rules: [] },
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// createLinky.
// ---------------------------------------------------------------------------

describe("createLinky", () => {
  it("attributes a user-owned Linky and does NOT mint a claim token", async () => {
    asMock(repo.insertLinkyRecord).mockResolvedValueOnce(linkyRecord());

    const result = await createLinky(
      {
        urls: ["https://a.example/"],
        source: "sdk",
        clientIp: "1.2.3.4",
        userAgent: "vitest",
      },
      userSubject(),
    );

    expect(result.slug).toBe("abc123");
    expect(result.claim).toBeUndefined();
    expect(claimTokens.createClaimToken).not.toHaveBeenCalled();

    const [insertArg] = asMock(repo.insertLinkyRecord).mock.calls[0];
    expect(insertArg.ownerUserId).toBe("user_alice");
    expect(insertArg.ownerOrgId).toBeNull();
    expect(insertArg.creatorFingerprint).toBeNull();
  });

  it("attributes an org-owned Linky when the subject is org-context", async () => {
    asMock(repo.insertLinkyRecord).mockResolvedValueOnce(
      linkyRecord({ owner: { type: "org", orgId: "org_acme" } }),
    );

    await createLinky(
      {
        urls: ["https://a.example/"],
        source: "sdk",
        clientIp: "1.2.3.4",
        userAgent: "vitest",
      },
      orgSubject(),
    );

    const [insertArg] = asMock(repo.insertLinkyRecord).mock.calls[0];
    expect(insertArg.ownerOrgId).toBe("org_acme");
    expect(insertArg.ownerUserId).toBeNull();
  });

  it("mints a claim token for anonymous creates", async () => {
    asMock(repo.insertLinkyRecord).mockResolvedValueOnce(
      linkyRecord({ owner: { type: "anonymous" } }),
    );
    asMock(claimTokens.createClaimToken).mockResolvedValueOnce({
      token: "tok_xyz",
      expiresAt: "2026-02-01T00:00:00.000Z",
    });

    const result = await createLinky(
      {
        urls: ["https://a.example/"],
        source: "sdk",
        clientIp: "1.2.3.4",
        userAgent: "vitest",
      },
      anonymousSubject(),
    );

    expect(result.claim?.token).toBe("tok_xyz");
    expect(result.claim?.expiresAt).toBe("2026-02-01T00:00:00.000Z");
    expect(result.claim?.warningMessage).toMatch(/only once/);
  });

  it("rejects a links:read bearer calling create", async () => {
    const readOnly: AuthenticatedSubject = userSubject({
      scopes: ["links:read"],
    });

    await expect(
      createLinky(
        {
          urls: ["https://a.example/"],
          source: "sdk",
          clientIp: "1.2.3.4",
          userAgent: "vitest",
        },
        readOnly,
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(repo.insertLinkyRecord).not.toHaveBeenCalled();
  });

  it("refuses bundles that exceed the plan's per-Linky URL cap", async () => {
    const subject = userSubject();
    const tooMany = Array.from({ length: 26 }, (_, i) => `https://a${i}.example/`);

    await expect(
      createLinky(
        {
          urls: tooMany,
          source: "sdk",
          clientIp: "1.2.3.4",
          userAgent: "vitest",
        },
        subject,
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "BAD_REQUEST" });
  });

  it("drops caller-provided _linky keys and injects server attribution", async () => {
    asMock(repo.insertLinkyRecord).mockResolvedValueOnce(linkyRecord());

    await createLinky(
      {
        urls: ["https://a.example/"],
        source: "sdk",
        clientIp: "1.2.3.4",
        userAgent: "vitest",
        clientAttribution: "cursor/skill-v1",
        metadata: {
          pageTitle: "demo",
          _linky: { client: "forged/1.0" },
        },
      },
      userSubject(),
    );

    const [insertArg] = asMock(repo.insertLinkyRecord).mock.calls[0];
    expect(insertArg.metadata).toEqual({
      pageTitle: "demo",
      _linky: { client: "cursor/skill-v1" },
    });
  });
});

// ---------------------------------------------------------------------------
// getLinky / listLinkies / getLinkyVersions.
// ---------------------------------------------------------------------------

describe("read surfaces", () => {
  it("getLinky returns the DTO when the caller is the owner", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());

    const dto = await getLinky({ slug: "abc123" }, userSubject());
    expect(dto.slug).toBe("abc123");
    expect(dto.urls).toEqual(["https://a.example/"]);
  });

  it("getLinky 404s on a missing slug", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(null);

    await expect(
      getLinky({ slug: "abc123" }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 404, code: "NOT_FOUND" });
  });

  it("getLinky 403s when the caller is not the owner", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(
      linkyRecord({ owner: { type: "user", userId: "user_bob" } }),
    );

    await expect(
      getLinky({ slug: "abc123" }, userSubject({ userId: "user_alice" })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("listLinkies filters by org when the subject is org-context", async () => {
    asMock(repo.listLinkiesForSubject).mockResolvedValueOnce([
      linkyRecord({ owner: { type: "org", orgId: "org_acme" } }),
    ]);

    const dto = await listLinkies({ limit: 5, offset: 0 }, orgSubject());
    expect(dto.linkies).toHaveLength(1);
    expect(dto.pagination).toEqual({ limit: 5, offset: 0 });
    expect(dto.subject).toEqual({ type: "org", orgId: "org_acme" });

    const [listArg] = asMock(repo.listLinkiesForSubject).mock.calls[0];
    expect(listArg).toEqual({
      type: "org",
      orgId: "org_acme",
      limit: 5,
      offset: 0,
    });
  });

  it("parseListPagination clamps + validates", () => {
    expect(parseListPagination({})).toEqual({ limit: 20, offset: 0 });
    expect(() => parseListPagination({ limit: 0 })).toThrow();
    expect(() => parseListPagination({ limit: 101 })).toThrow();
    expect(() => parseListPagination({ offset: -1 })).toThrow();
    expect(parseListPagination({ limit: "10", offset: "3" })).toEqual({
      limit: 10,
      offset: 3,
    });
  });

  it("getLinkyVersions delegates to listLinkyVersions and maps DTOs", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());
    asMock(repo.listLinkyVersions).mockResolvedValueOnce([
      {
        versionNumber: 1,
        urls: ["https://a.example/"],
        urlMetadata: [{}],
        title: null,
        description: null,
        resolutionPolicy: { version: 1, rules: [] },
        editedByClerkUserId: "user_alice",
        editedAt: "2026-01-02T00:00:00.000Z",
      },
    ]);

    const dto = await getLinkyVersions({ slug: "abc123" }, userSubject());
    expect(dto.versions).toHaveLength(1);
    expect(dto.versions[0].versionNumber).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// updateLinky.
// ---------------------------------------------------------------------------

describe("updateLinky", () => {
  it("PATCHes and returns the updated DTO", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());
    asMock(repo.patchLinkyRecord).mockResolvedValueOnce(
      linkyRecord({ title: "Renamed" }),
    );

    const dto = await updateLinky(
      { slug: "abc123", title: "Renamed" },
      userSubject(),
    );
    expect(dto.title).toBe("Renamed");
  });

  it("404s when the row disappears between read and patch", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());
    asMock(repo.patchLinkyRecord).mockResolvedValueOnce(null);

    await expect(
      updateLinky({ slug: "abc123", title: "x" }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("rejects a links:read bearer token", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());

    await expect(
      updateLinky(
        { slug: "abc123", title: "x" },
        userSubject({ scopes: ["links:read"] }),
      ),
    ).rejects.toMatchObject({ statusCode: 403 });

    expect(repo.patchLinkyRecord).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// deleteLinky.
// ---------------------------------------------------------------------------

describe("deleteLinky", () => {
  it("soft-deletes when the caller is the owner (user)", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(linkyRecord());
    asMock(repo.softDeleteLinkyRecord).mockResolvedValueOnce(true);

    const result = await deleteLinky({ slug: "abc123" }, userSubject());
    expect(result.slug).toBe("abc123");
    expect(result.deletedAt).toMatch(/Z$/);
  });

  it("gates delete on the admin role for org-owned bundles", async () => {
    asMock(repo.getLinkyRecordBySlug).mockResolvedValueOnce(
      linkyRecord({ owner: { type: "org", orgId: "org_acme" } }),
    );
    // Editor-role org subject attempting to delete an org-owned Linky.
    const editor = orgSubject({ role: "org:member" });

    await expect(
      deleteLinky({ slug: "abc123" }, editor),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});
