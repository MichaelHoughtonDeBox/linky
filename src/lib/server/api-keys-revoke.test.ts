import { beforeEach, describe, expect, it, vi } from "vitest";

// ============================================================================
// revokeApiKeyForSubject — SQL parameter-numbering regression test.
//
// Sprint 2.8 post-launch fix — Bug #4.
//
// The previous implementation concatenated `WHERE id = $1 AND ${ownership.clause}`,
// and `ownership.clause` (from subjectOwnershipClause) hard-coded `$1` for
// the owner column — producing a query where `$1` was bound to both the
// api_keys.id (integer) and the owner_user_id (text). Every revoke attempt
// 500'd in production. No unit test caught it because all existing tests
// mocked pg at a higher layer; the raw SQL shape was untested.
//
// These tests assert:
//
//   1. Revoking a user-owned key sends SQL with DISTINCT placeholders
//      (`$1` for id, `$2` for owner_user_id) and params in that order.
//   2. Revoking an org-owned key does the same with owner_org_id.
//   3. The WHERE clause contains BOTH the id equality AND the ownership
//      clause (no smuggling — a user cannot revoke another subject's key
//      just by guessing its id).
//   4. Zero rows back from pg (key not owned by the caller, or no such id)
//      returns null — the caller converts that to a 404 at the service
//      layer.
// ============================================================================

vi.mock("@/lib/server/postgres", () => {
  const pool = {
    query: vi.fn(),
  };
  return { getPgPool: () => pool };
});

import * as pg from "@/lib/server/postgres";
import { revokeApiKeyForSubject } from "./api-keys";

function mockPool() {
  return pg.getPgPool() as unknown as {
    query: ReturnType<typeof vi.fn>;
  };
}

function revokedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 123,
    key_prefix: "lkyu_deadbeef",
    secret_hash: "sha256hex",
    owner_user_id: "user_alice",
    owner_org_id: null,
    name: "probe",
    scopes: ["links:read"],
    rate_limit_per_hour: 1000,
    created_by_clerk_user_id: "user_alice",
    created_at: new Date("2026-01-01T00:00:00Z"),
    last_used_at: null,
    revoked_at: new Date("2026-04-19T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  mockPool().query.mockReset();
});

describe("revokeApiKeyForSubject — user-owned", () => {
  it("sends SQL with $1 for id and $2 for owner_user_id (no collision)", async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [revokedRow({ id: 123 })],
    });

    const result = await revokeApiKeyForSubject({
      apiKeyId: 123,
      subject: {
        type: "user",
        userId: "user_alice",
      },
    });

    expect(result).not.toBeNull();
    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];
    const normalizedSql = String(sql).replace(/\s+/g, " ");

    // The critical assertion: `$1` and `$2` appear, `$1` is bound to the
    // api key id, `$2` is bound to the owner_user_id. The old code had
    // two `$1`s and would fail this check loudly.
    expect(normalizedSql).toMatch(/WHERE id = \$1/);
    expect(normalizedSql).toMatch(/owner_user_id = \$2 AND owner_org_id IS NULL/);
    expect(normalizedSql).not.toMatch(/owner_user_id = \$1/);
    expect(params).toEqual([123, "user_alice"]);
  });

  it("returns null when pg reports rowCount 0", async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce({ rowCount: 0, rows: [] });

    const result = await revokeApiKeyForSubject({
      apiKeyId: 999,
      subject: { type: "user", userId: "user_bob" },
    });

    expect(result).toBeNull();
  });
});

describe("revokeApiKeyForSubject — org-owned", () => {
  it("sends SQL with $1 for id and $2 for owner_org_id (no collision)", async () => {
    const pool = mockPool();
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [revokedRow({ owner_user_id: null, owner_org_id: "org_acme" })],
    });

    await revokeApiKeyForSubject({
      apiKeyId: 77,
      subject: {
        type: "org",
        orgId: "org_acme",
        userId: "user_acting",
        role: "admin",
      },
    });

    const [sql, params] = pool.query.mock.calls[0];
    const normalizedSql = String(sql).replace(/\s+/g, " ");

    expect(normalizedSql).toMatch(/WHERE id = \$1/);
    expect(normalizedSql).toMatch(/owner_org_id = \$2 AND owner_user_id IS NULL/);
    expect(normalizedSql).not.toMatch(/owner_org_id = \$1/);
    expect(params).toEqual([77, "org_acme"]);
  });
});

describe("revokeApiKeyForSubject — ownership scoping", () => {
  it("keeps both id AND ownership predicates in the WHERE clause", async () => {
    // Regression guard against a different failure mode: a fix that
    // drops the ownership clause entirely to avoid the collision would
    // let one user revoke another user's key by id. The scoping is
    // load-bearing for the multi-tenant security model.
    const pool = mockPool();
    pool.query.mockResolvedValueOnce({
      rowCount: 1,
      rows: [revokedRow()],
    });

    await revokeApiKeyForSubject({
      apiKeyId: 1,
      subject: { type: "user", userId: "user_alice" },
    });

    const [sql] = pool.query.mock.calls[0];
    const normalizedSql = String(sql).replace(/\s+/g, " ");

    expect(normalizedSql).toMatch(/WHERE id = \$1\s+AND\s+owner_user_id = \$2/);
  });
});
