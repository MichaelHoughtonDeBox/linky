import "server-only";

import {
  createApiKeyForSubject,
  listApiKeysForSubject,
  normalizeApiKeyName,
  parseScopesInput,
  revokeApiKeyForSubject,
  type ApiKeyPermission,
  type ApiKeyRecord,
} from "@/lib/server/api-keys";
import {
  ForbiddenError,
  requireScope,
  roleOfSubject,
  type AuthenticatedSubject,
} from "@/lib/server/auth";
import { LinkyError } from "@/lib/linky/errors";

// ============================================================================
// API keys service — Sprint 2.8 Chunk 0.
//
// Admin-only surfaces (list, create, revoke) + the `whoami` read that every
// bearer-authed caller is allowed to hit. Session subjects (browser Clerk
// auth) ignore scope — `requireScope` no-ops on them because their
// `scopes` field is undefined.
//
// Sprint 2.7 Chunk C: admin-only on org-owned subjects for session callers.
// Sprint 2.7 Chunk D: bearer keys need `keys:admin` explicitly.
// ============================================================================

export type ApiKeyDto = {
  id: number;
  name: string;
  scope: ApiKeyRecord["scope"];
  scopes: ApiKeyPermission[];
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type SubjectDto =
  | { type: "user"; userId: string }
  | { type: "org"; orgId: string; userId: string | null };

export type KeyListResponse = {
  apiKeys: ApiKeyDto[];
  subject: SubjectDto;
};

export type CreatedKeyResponse = {
  apiKey: ApiKeyDto;
  rawKey: string;
  warning: string;
};

export type RevokedKeyResponse = {
  apiKey: ApiKeyDto;
};

export type WhoAmIResponse = KeyListResponse;

export type CreateKeyInput = {
  name: unknown;
  scopes?: unknown;
};

export type RevokeKeyInput = {
  id: number;
};

function toApiKeyDto(record: ApiKeyRecord): ApiKeyDto {
  return {
    id: record.id,
    name: record.name,
    scope: record.scope,
    scopes: record.scopes,
    keyPrefix: record.keyPrefix,
    createdAt: record.createdAt,
    lastUsedAt: record.lastUsedAt,
    revokedAt: record.revokedAt,
  };
}

function subjectDto(subject: AuthenticatedSubject): SubjectDto {
  if (subject.type === "org") {
    return { type: "org", orgId: subject.orgId, userId: subject.userId };
  }
  return { type: "user", userId: subject.userId };
}

function requireAdminForKeyManagement(subject: AuthenticatedSubject): void {
  requireScope(subject, "keys:admin");

  if (subject.type === "org" && roleOfSubject(subject) !== "admin") {
    throw new ForbiddenError(
      "Only org admins can manage API keys. Ask an admin to promote your role or mint the key on your behalf.",
    );
  }
}

export async function listKeys(
  subject: AuthenticatedSubject,
): Promise<KeyListResponse> {
  requireAdminForKeyManagement(subject);

  const records = await listApiKeysForSubject(subject);
  return {
    apiKeys: records.map(toApiKeyDto),
    subject: subjectDto(subject),
  };
}

export async function whoAmI(
  subject: AuthenticatedSubject,
): Promise<WhoAmIResponse> {
  // Whoami shares the list endpoint today: `GET /api/me/keys` returns the
  // caller's keys when they have `keys:admin`, and functions as the auth
  // identity probe the CLI uses to validate a bearer token. We keep the
  // alias because the MCP tool surface (Chunk A) will expose `whoami`
  // separately — callers with only `links:read` need SOME way to verify
  // "who am I" without promoting to `keys:admin`, so Chunk A's whoami
  // tool will diverge from `listKeys`. For Chunk 0 we preserve today's
  // behavior byte-for-byte.
  return listKeys(subject);
}

export async function createKey(
  input: CreateKeyInput,
  subject: AuthenticatedSubject,
): Promise<CreatedKeyResponse> {
  requireAdminForKeyManagement(subject);

  const name = normalizeApiKeyName(input.name);
  // Sprint 2.7 Chunk D: optional scopes on the create body. Missing scopes
  // default to ['links:write'] so Sprint 2.6 automation that POSTs
  // `{ name }` without touching scopes does not regress. Unknown scope
  // strings reject at this gate.
  const scopes = parseScopesInput(input.scopes);

  const created = await createApiKeyForSubject({
    subject,
    name,
    scopes,
    // Org API-key subjects may not carry a human creator id (service
    // automation minting a fresh org key). We preserve the `?? ""` fallback
    // from the pre-refactor route rather than inventing an identity.
    createdByClerkUserId:
      subject.type === "user" ? subject.userId : subject.userId ?? "",
  });

  return {
    apiKey: toApiKeyDto(created.apiKey),
    rawKey: created.rawKey,
    warning:
      "Save this API key now — it is shown only once and cannot be recovered.",
  };
}

export async function revokeKey(
  input: RevokeKeyInput,
  subject: AuthenticatedSubject,
): Promise<RevokedKeyResponse> {
  requireAdminForKeyManagement(subject);

  if (!Number.isFinite(input.id) || input.id <= 0) {
    throw new LinkyError("`id` must be a positive integer.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const revoked = await revokeApiKeyForSubject({
    apiKeyId: input.id,
    subject,
  });

  if (!revoked) {
    throw new LinkyError("API key not found.", {
      code: "NOT_FOUND",
      statusCode: 404,
    });
  }

  return { apiKey: toApiKeyDto(revoked) };
}
