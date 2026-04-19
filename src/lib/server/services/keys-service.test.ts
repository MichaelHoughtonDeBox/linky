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

vi.mock("@/lib/server/api-keys", async () => {
  const actual = await vi.importActual<typeof import("@/lib/server/api-keys")>(
    "@/lib/server/api-keys",
  );
  return {
    ...actual,
    listApiKeysForSubject: vi.fn(),
    createApiKeyForSubject: vi.fn(),
    revokeApiKeyForSubject: vi.fn(),
  };
});

import type { ApiKeyRecord } from "@/lib/server/api-keys";
import * as keysRepo from "@/lib/server/api-keys";
import type { OrgSubject, UserSubject } from "@/lib/server/auth";

import { createKey, listKeys, revokeKey, whoAmI } from "./keys-service";

const asMock = <T extends (...args: never[]) => unknown>(fn: T) =>
  fn as unknown as ReturnType<typeof vi.fn>;

function userSubject(overrides: Partial<UserSubject> = {}): UserSubject {
  return { type: "user", userId: "user_alice", ...overrides };
}

function orgAdmin(overrides: Partial<OrgSubject> = {}): OrgSubject {
  return {
    type: "org",
    orgId: "org_acme",
    userId: "user_alice",
    role: "org:admin",
    ...overrides,
  };
}

function keyRecord(overrides: Partial<ApiKeyRecord> = {}): ApiKeyRecord {
  return {
    id: 1,
    name: "ci bot",
    scope: "user",
    scopes: ["links:write"],
    keyPrefix: "lkyu_deadbeef",
    createdAt: "2026-01-01T00:00:00.000Z",
    lastUsedAt: null,
    revokedAt: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("listKeys + whoAmI", () => {
  it("returns the subject's keys for an admin subject", async () => {
    asMock(keysRepo.listApiKeysForSubject).mockResolvedValueOnce([keyRecord()]);

    const dto = await listKeys(userSubject());
    expect(dto.apiKeys).toHaveLength(1);
    expect(dto.subject).toEqual({ type: "user", userId: "user_alice" });
  });

  it("rejects org non-admins on session-subject call", async () => {
    const editor = orgAdmin({ role: "org:member" });

    await expect(listKeys(editor)).rejects.toMatchObject({
      statusCode: 403,
      code: "FORBIDDEN",
    });
  });

  it("rejects a bearer caller lacking keys:admin", async () => {
    await expect(
      listKeys(userSubject({ scopes: ["links:read"] })),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("whoAmI shares the listKeys contract", async () => {
    asMock(keysRepo.listApiKeysForSubject).mockResolvedValueOnce([keyRecord()]);
    const dto = await whoAmI(userSubject());
    expect(dto.apiKeys).toHaveLength(1);
  });
});

describe("createKey", () => {
  it("creates a key with the default scope when none is given", async () => {
    asMock(keysRepo.createApiKeyForSubject).mockResolvedValueOnce({
      apiKey: keyRecord(),
      rawKey: "lkyu_deadbeef.secret",
    });

    const dto = await createKey({ name: "ci bot" }, userSubject());
    expect(dto.rawKey).toBe("lkyu_deadbeef.secret");
    expect(dto.apiKey.name).toBe("ci bot");
    expect(dto.warning).toMatch(/only once/);

    const [arg] = asMock(keysRepo.createApiKeyForSubject).mock.calls[0];
    expect(arg.scopes).toEqual(["links:write"]);
  });

  it("validates a custom scope list", async () => {
    await expect(
      createKey(
        { name: "ci bot", scopes: ["links:read", "keys:admin", "bogus"] },
        userSubject(),
      ),
    ).rejects.toMatchObject({ statusCode: 400 });

    expect(keysRepo.createApiKeyForSubject).not.toHaveBeenCalled();
  });

  it("rejects empty names", async () => {
    await expect(
      createKey({ name: "   " }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("revokeKey", () => {
  it("revokes an owned key", async () => {
    asMock(keysRepo.revokeApiKeyForSubject).mockResolvedValueOnce(
      keyRecord({ revokedAt: "2026-02-01T00:00:00.000Z" }),
    );

    const dto = await revokeKey({ id: 1 }, userSubject());
    expect(dto.apiKey.revokedAt).toBe("2026-02-01T00:00:00.000Z");
  });

  it("404s when the repository returns null", async () => {
    asMock(keysRepo.revokeApiKeyForSubject).mockResolvedValueOnce(null);
    await expect(
      revokeKey({ id: 99 }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it("400s on invalid ids", async () => {
    await expect(
      revokeKey({ id: -1 }, userSubject()),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
