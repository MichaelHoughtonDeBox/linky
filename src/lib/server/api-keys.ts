import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { LinkyError, RateLimitError } from "@/lib/linky/errors";

import type { AuthenticatedSubject, OrgSubject, UserSubject } from "./auth";
import { getPgPool } from "./postgres";
import { checkRateLimit } from "./rate-limit";

export type ApiKeyScope = "user" | "org";

// Sprint 2.7 Chunk D: per-action scope claims. Independent of the
// user/org ownership scope above — same word, different concept.
// Keeping both names is deliberate: `scope` on ApiKeyRecord describes
// which subject the key belongs to; `scopes` on the same record lists
// what actions the key is allowed to perform.
export type ApiKeyPermission = "links:read" | "links:write" | "keys:admin";

export const API_KEY_PERMISSIONS: readonly ApiKeyPermission[] = [
  "links:read",
  "links:write",
  "keys:admin",
] as const;

export type ApiKeyRecord = {
  id: number;
  name: string;
  scope: ApiKeyScope;
  scopes: ApiKeyPermission[];
  keyPrefix: string;
  // Sprint 2.8 Chunk D: per-key hourly quota. 0 = unlimited.
  rateLimitPerHour: number;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

type SubjectOwnedApiKey = UserSubject | OrgSubject;

type DbApiKeyRow = {
  id: number;
  key_prefix: string;
  secret_hash: string;
  owner_user_id: string | null;
  owner_org_id: string | null;
  name: string;
  scopes: unknown;
  rate_limit_per_hour: number | string | null;
  created_by_clerk_user_id: string | null;
  created_at: Date | string;
  last_used_at: Date | string | null;
  revoked_at: Date | string | null;
};

const USER_KEY_PREFIX = "lkyu";
const ORG_KEY_PREFIX = "lkyo";
const RAW_KEY_PATTERN = /^(lkyu|lkyo)_([a-f0-9]{8})\.([A-Za-z0-9_-]{24,})$/;
const MAX_API_KEY_NAME_LENGTH = 80;

function toIso(value: Date | string | null): string | null {
  if (!value) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function mapDbRow(row: DbApiKeyRow): ApiKeyRecord {
  return {
    id: row.id,
    name: row.name,
    scope: row.owner_org_id ? "org" : "user",
    scopes: normalizeScopes(row.scopes),
    keyPrefix: row.key_prefix,
    rateLimitPerHour: normalizeRateLimit(row.rate_limit_per_hour),
    createdAt: toIso(row.created_at) ?? new Date(0).toISOString(),
    lastUsedAt: toIso(row.last_used_at),
    revokedAt: toIso(row.revoked_at),
  };
}

// ---------------------------------------------------------------------------
// Rate limit helpers (Sprint 2.8 Chunk D).
//
// `DEFAULT_RATE_LIMIT_PER_HOUR` matches the migration's DEFAULT so
// legacy rows (written before this sprint) fall into the same bucket
// shape the new default mints. The DB constraint guarantees values are
// non-negative, so `normalizeRateLimit` is only a shape guard against
// NULLs returned by pg for legacy rows in tests that mock partial
// DbApiKeyRow objects.
//
// `MAX_RATE_LIMIT_PER_HOUR` is a sanity cap on the API input — we don't
// enforce it in the DB (no upper bound in the CHECK constraint) because
// a future internal use case might want higher; but the public POST
// surface rejects anything above it so a typo in the dashboard can't
// mint a key with a 10M/hour limit.
// ---------------------------------------------------------------------------

export const DEFAULT_RATE_LIMIT_PER_HOUR = 1000;
export const MAX_RATE_LIMIT_PER_HOUR = 100_000;

function normalizeRateLimit(raw: number | string | null | undefined): number {
  if (raw === null || raw === undefined) return DEFAULT_RATE_LIMIT_PER_HOUR;
  const parsed = typeof raw === "number" ? raw : Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_RATE_LIMIT_PER_HOUR;
  }
  return Math.floor(parsed);
}

export function parseRateLimitInput(raw: unknown): number {
  if (raw === undefined || raw === null) return DEFAULT_RATE_LIMIT_PER_HOUR;

  const parsed = typeof raw === "number" ? raw : Number.parseInt(String(raw), 10);
  if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
    throw new LinkyError(
      "`rateLimitPerHour` must be a non-negative integer.",
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }
  if (parsed > MAX_RATE_LIMIT_PER_HOUR) {
    throw new LinkyError(
      `\`rateLimitPerHour\` must be at most ${MAX_RATE_LIMIT_PER_HOUR}.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }
  return parsed;
}

// ---------------------------------------------------------------------------
// Scope validation + expansion.
//
// `normalizeScopes(raw)` turns whatever the DB returned into a deduped,
// allow-list-filtered ApiKeyPermission[]. Unknown scopes are silently
// dropped on read (we don't want a bad row to break authentication for
// the whole system) but REJECTED at mint time (see parseScopesInput).
//
// `expandScopes(stored)` applies implication rules:
//   links:write  implies links:read
//   keys:admin   implies links:write (and transitively links:read)
// so a call-site can ask `expanded.has("links:read")` without first
// checking for the write/admin upgrade path.
//
// Both helpers are pure. Tests in api-keys.test.ts lock the matrix.
// ---------------------------------------------------------------------------

function isApiKeyPermission(value: unknown): value is ApiKeyPermission {
  return (
    value === "links:read" ||
    value === "links:write" ||
    value === "keys:admin"
  );
}

export function normalizeScopes(raw: unknown): ApiKeyPermission[] {
  if (!Array.isArray(raw)) return [];
  const deduped = new Set<ApiKeyPermission>();
  for (const entry of raw) {
    if (isApiKeyPermission(entry)) deduped.add(entry);
  }
  return Array.from(deduped);
}

export function expandScopes(stored: readonly ApiKeyPermission[]): Set<ApiKeyPermission> {
  const out = new Set<ApiKeyPermission>();
  for (const scope of stored) {
    out.add(scope);
    if (scope === "links:write") {
      out.add("links:read");
    }
    if (scope === "keys:admin") {
      out.add("links:read");
      out.add("links:write");
    }
  }
  return out;
}

export function parseScopesInput(raw: unknown): ApiKeyPermission[] {
  // On mint, unknown scopes must REJECT — silent filtering could let a
  // typo ("link:read") ship a key with fewer privileges than intended.
  if (raw === undefined) {
    // No scope supplied → default to today's full-edit behavior so Sprint 2.6
    // automation that POSTs { name } without scopes does not regress.
    return ["links:write"];
  }
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new LinkyError(
      "`scopes` must be a non-empty array of scope strings.",
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }
  const deduped = new Set<ApiKeyPermission>();
  for (const entry of raw) {
    if (!isApiKeyPermission(entry)) {
      throw new LinkyError(
        `Unknown scope '${String(entry)}'. Allowed: ${API_KEY_PERMISSIONS.join(", ")}.`,
        { code: "BAD_REQUEST", statusCode: 400 },
      );
    }
    deduped.add(entry);
  }
  return Array.from(deduped);
}

// Builds the `WHERE owner_* = $N AND owner_* IS NULL` predicate that scopes
// a query to a subject's own keys. Callers that prepend other parameters
// (e.g. the revoke query, which binds `id = $1` first) must pass
// `paramOffset` = the number of parameters already consumed, so the
// placeholder in this clause is numbered correctly in the final SQL.
//
// Default offset 0 preserves the original "just $1" shape for
// single-parameter queries (e.g. listApiKeysForSubject).
//
// Sprint 2.8 post-launch fix — Bug #4: the revoke path concatenated this
// clause after `id = $1`, producing a query where `$1` was bound to both
// the api_keys.id (integer) and the owner_user_id (text). pg either
// errored or returned zero rows depending on types. No test mocked the
// real pg client so the collision shipped silently.
function subjectOwnershipClause(
  subject: SubjectOwnedApiKey,
  paramOffset = 0,
): { clause: string; params: string[] } {
  const placeholder = `$${paramOffset + 1}`;
  if (subject.type === "org") {
    return {
      clause: `owner_org_id = ${placeholder} AND owner_user_id IS NULL`,
      params: [subject.orgId],
    };
  }

  return {
    clause: `owner_user_id = ${placeholder} AND owner_org_id IS NULL`,
    params: [subject.userId],
  };
}

function keyPrefixForScope(scope: ApiKeyScope, publicId: string): string {
  return `${scope === "org" ? ORG_KEY_PREFIX : USER_KEY_PREFIX}_${publicId}`;
}

function mintApiKey(scope: ApiKeyScope): {
  rawKey: string;
  keyPrefix: string;
  secretHash: string;
} {
  // Public id is short + hex-only so the displayed prefix is easy to read,
  // log, and paste into support/debugging conversations.
  const publicId = randomBytes(4).toString("hex");
  // Secret is the real bearer credential. Base64url keeps it shell-safe.
  const secret = randomBytes(24).toString("base64url");
  const keyPrefix = keyPrefixForScope(scope, publicId);
  return {
    rawKey: `${keyPrefix}.${secret}`,
    keyPrefix,
    secretHash: hashApiKeySecret(secret),
  };
}

export function parseRawApiKey(
  rawKey: string,
): { scope: ApiKeyScope; keyPrefix: string; secret: string } | null {
  const trimmed = rawKey.trim();
  const match = RAW_KEY_PATTERN.exec(trimmed);
  if (!match) return null;

  return {
    scope: match[1] === ORG_KEY_PREFIX ? "org" : "user",
    keyPrefix: `${match[1]}_${match[2]}`,
    secret: match[3],
  };
}

export function hashApiKeySecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function normalizeApiKeyName(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new LinkyError("`name` must be a string.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    throw new LinkyError("`name` cannot be empty.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  if (trimmed.length > MAX_API_KEY_NAME_LENGTH) {
    throw new LinkyError(
      `\`name\` must be at most ${MAX_API_KEY_NAME_LENGTH} characters.`,
      {
        code: "BAD_REQUEST",
        statusCode: 400,
      },
    );
  }

  return trimmed;
}

export async function listApiKeysForSubject(
  subject: SubjectOwnedApiKey,
): Promise<ApiKeyRecord[]> {
  const pool = getPgPool();
  const ownership = subjectOwnershipClause(subject);

  const result = await pool.query<DbApiKeyRow>(
    `
    SELECT
      id,
      key_prefix,
      secret_hash,
      owner_user_id,
      owner_org_id,
      name,
      scopes,
      rate_limit_per_hour,
      created_by_clerk_user_id,
      created_at,
      last_used_at,
      revoked_at
    FROM api_keys
    WHERE ${ownership.clause}
    ORDER BY created_at DESC, id DESC
    `,
    ownership.params,
  );

  return result.rows.map(mapDbRow);
}

export async function createApiKeyForSubject(input: {
  subject: SubjectOwnedApiKey;
  name: string;
  scopes: ApiKeyPermission[];
  rateLimitPerHour?: number;
  createdByClerkUserId: string;
}): Promise<{ apiKey: ApiKeyRecord; rawKey: string }> {
  const pool = getPgPool();
  const scope: ApiKeyScope = input.subject.type === "org" ? "org" : "user";
  const minted = mintApiKey(scope);
  const rateLimitPerHour =
    input.rateLimitPerHour ?? DEFAULT_RATE_LIMIT_PER_HOUR;

  const result = await pool.query<DbApiKeyRow>(
    `
    INSERT INTO api_keys (
      key_prefix,
      secret_hash,
      owner_user_id,
      owner_org_id,
      name,
      scopes,
      rate_limit_per_hour,
      created_by_clerk_user_id
    )
    VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8)
    RETURNING
      id,
      key_prefix,
      secret_hash,
      owner_user_id,
      owner_org_id,
      name,
      scopes,
      rate_limit_per_hour,
      created_by_clerk_user_id,
      created_at,
      last_used_at,
      revoked_at
    `,
    [
      minted.keyPrefix,
      minted.secretHash,
      input.subject.type === "user" ? input.subject.userId : null,
      input.subject.type === "org" ? input.subject.orgId : null,
      input.name,
      JSON.stringify(input.scopes),
      rateLimitPerHour,
      input.createdByClerkUserId,
    ],
  );

  return {
    apiKey: mapDbRow(result.rows[0]),
    rawKey: minted.rawKey,
  };
}

export async function revokeApiKeyForSubject(input: {
  apiKeyId: number;
  subject: SubjectOwnedApiKey;
}): Promise<ApiKeyRecord | null> {
  const pool = getPgPool();
  // `id = $1` consumes the first placeholder slot; the ownership clause's
  // placeholder must start at $2. See subjectOwnershipClause for the full
  // rationale + the post-launch regression this closed.
  const ownership = subjectOwnershipClause(input.subject, 1);

  const result = await pool.query<DbApiKeyRow>(
    `
    UPDATE api_keys
    SET revoked_at = COALESCE(revoked_at, NOW())
    WHERE id = $1
      AND ${ownership.clause}
    RETURNING
      id,
      key_prefix,
      secret_hash,
      owner_user_id,
      owner_org_id,
      name,
      scopes,
      rate_limit_per_hour,
      created_by_clerk_user_id,
      created_at,
      last_used_at,
      revoked_at
    `,
    [input.apiKeyId, ...ownership.params],
  );

  if (result.rowCount === 0) return null;
  return mapDbRow(result.rows[0]);
}

export async function authenticateApiKey(
  rawKey: string,
): Promise<AuthenticatedSubject | null> {
  const parsed = parseRawApiKey(rawKey);
  if (!parsed) return null;

  const pool = getPgPool();
  const result = await pool.query<DbApiKeyRow>(
    `
    UPDATE api_keys
    SET last_used_at = NOW()
    WHERE key_prefix = $1
      AND secret_hash = $2
      AND revoked_at IS NULL
    RETURNING
      id,
      key_prefix,
      secret_hash,
      owner_user_id,
      owner_org_id,
      name,
      scopes,
      rate_limit_per_hour,
      created_by_clerk_user_id,
      created_at,
      last_used_at,
      revoked_at
    `,
    [parsed.keyPrefix, hashApiKeySecret(parsed.secret)],
  );

  if (result.rowCount === 0) return null;

  const row = result.rows[0];
  const scopes = normalizeScopes(row.scopes);
  const rateLimitPerHour = normalizeRateLimit(row.rate_limit_per_hour);

  // Sprint 2.8 Chunk D: consult the per-key hourly bucket AFTER the
  // secret_hash check passes. This ordering matters:
  //
  //   - `rate_limit_per_hour === 0` means "unlimited" — common for
  //     internal / admin keys. Skip the bucket lookup entirely so a
  //     hot internal path doesn't pay the Map traversal cost.
  //   - Unknown / invalid keys never reach this branch (rowCount === 0
  //     short-circuits above), so we never burn a bucket slot on a
  //     forged token.
  //   - The bucket key includes the numeric `api_keys.id` — NOT the
  //     key_prefix — so revoking + re-issuing a key with the same
  //     prefix (we don't do that today, but could) starts a fresh
  //     bucket and doesn't inherit the old key's hot-usage signal.
  if (rateLimitPerHour > 0) {
    const limit = checkRateLimit(`apikey:${row.id}`, {
      windowMs: 60 * 60 * 1000,
      maxRequests: rateLimitPerHour,
    });
    if (!limit.allowed) {
      throw new RateLimitError(limit.retryAfterSeconds);
    }
  }

  if (row.owner_org_id) {
    // Org-scoped automation acts only as the org itself. We deliberately do
    // not smuggle a user identity through bearer auth — that would let a team
    // key reach personal resources tied to the creator's user id.
    return {
      type: "org",
      orgId: row.owner_org_id,
      userId: null,
      role: null,
      scopes,
    };
  }

  if (row.owner_user_id) {
    return {
      type: "user",
      userId: row.owner_user_id,
      scopes,
    };
  }

  return null;
}
