import "server-only";

import { LinkyError } from "@/lib/linky/errors";
import type { ResolutionPolicy } from "@/lib/linky/policy";
import { generateSlug } from "@/lib/linky/slugs";
import type {
  CreateLinkyPayload,
  LinkyMetadata,
  LinkyRecord,
  LinkyVersionRecord,
  PatchLinkyPayload,
} from "@/lib/linky/types";
import {
  requireCanAdminLinky,
  requireCanEditLinky,
  requireCanViewLinky,
  requireScope,
  roleOfSubject,
  type AuthSubject,
  type AuthenticatedSubject,
} from "@/lib/server/auth";
import { createClaimToken } from "@/lib/server/claim-tokens";
import { getLimits } from "@/lib/server/entitlements";
import { computeCreatorFingerprint } from "@/lib/server/fingerprint";
import {
  getLinkyRecordBySlug,
  insertLinkyRecord,
  listLinkiesForSubject,
  listLinkyVersions,
  patchLinkyRecord,
  softDeleteLinkyRecord,
} from "@/lib/server/linkies-repository";

// ============================================================================
// Linkies service layer — Sprint 2.8 Chunk 0.
//
// HTTP routes under `src/app/api/links/*` and `src/app/api/me/links/*` thin-
// wrap this module. Every authed route's business logic — parsing side
// effects aside — lives here. The MCP tool handlers (Chunk A) call these
// functions directly, so behavior parity is guaranteed by construction.
//
// Invariants enforced here (not re-checked by the HTTP layer):
//   - Scope + role + ownership gates run BEFORE any DB write.
//   - Anonymous CREATE always mints a claim token.
//   - Slug collisions retry up to GENERATED_SLUG_ATTEMPTS times.
//
// HTTP-level concerns that stay in the route:
//   - Bearer-token extraction / session lookup (produces the AuthSubject).
//   - Rate limiting by client IP.
//   - JSON parsing of the request body.
//   - Response serialization to `Response.json(...)` (routes own the wire
//     shape because MCP serializes differently).
// ============================================================================

const GENERATED_SLUG_ATTEMPTS = 5;

export const CLAIM_WARNING_MESSAGE =
  "Save claimToken and claimUrl now — they are returned only once and cannot be recovered. If you lose them, the anonymous Linky stays public but can never be bound to an account.";

// ---------------------------------------------------------------------------
// DTO shapes. Services return plain objects; routes decide how to serialize.
// Keeping DTOs stable here lets the MCP layer (and tests) depend on them
// without importing from `route.ts`.
// ---------------------------------------------------------------------------

export type LinkyDto = {
  slug: string;
  urls: string[];
  urlMetadata: LinkyRecord["urlMetadata"];
  title: string | null;
  description: string | null;
  owner: LinkyRecord["owner"];
  createdAt: string;
  updatedAt: string;
  source: LinkyRecord["source"];
  metadata: LinkyMetadata | null;
  resolutionPolicy: ResolutionPolicy;
};

export type LinkyListItemDto = {
  slug: string;
  title: string | null;
  description: string | null;
  urls: string[];
  urlMetadata: LinkyRecord["urlMetadata"];
  owner: LinkyRecord["owner"];
  createdAt: string;
  updatedAt: string;
  source: LinkyRecord["source"];
};

export type LinkyVersionDto = {
  versionNumber: number;
  urls: string[];
  urlMetadata: LinkyVersionRecord["urlMetadata"];
  title: string | null;
  description: string | null;
  editedByClerkUserId: string | null;
  editedAt: string;
};

// ---------------------------------------------------------------------------
// Create.
// ---------------------------------------------------------------------------

export type CreateLinkyInput = CreateLinkyPayload & {
  // Request-side context the service cannot derive on its own. The route
  // pulls these off the `NextRequest`; the MCP handler pulls them off the
  // transport. Either way the service stays pure.
  clientIp: string;
  userAgent: string | null;
  clientAttribution?: string;
};

export type CreateLinkyResult = {
  slug: string;
  record: LinkyRecord;
  claim?: { token: string; expiresAt: string; warningMessage: string };
};

type AttributionFields = {
  ownerUserId: string | null;
  ownerOrgId: string | null;
  creatorFingerprint: string | null;
};

function resolveAttribution(
  subject: AuthSubject,
  ipAddress: string,
  userAgent: string | null,
): AttributionFields {
  if (subject.type === "org") {
    return {
      ownerUserId: null,
      ownerOrgId: subject.orgId,
      creatorFingerprint: null,
    };
  }

  if (subject.type === "user") {
    return {
      ownerUserId: subject.userId,
      ownerOrgId: null,
      creatorFingerprint: null,
    };
  }

  return {
    ownerUserId: null,
    ownerOrgId: null,
    creatorFingerprint: computeCreatorFingerprint(ipAddress, userAgent),
  };
}

// Merge server-injected metadata (e.g. the `Linky-Client` header) into the
// caller's metadata without clobbering their keys. Our fields live under
// the reserved `_linky` namespace; a caller attempting to write `_linky`
// themselves is silently dropped so attribution cannot be forged.
function mergeServerMetadata(
  caller: LinkyMetadata | undefined,
  clientAttribution: string | undefined,
): LinkyMetadata | undefined {
  const hasServerFields = clientAttribution !== undefined;
  if (!hasServerFields && !caller) return undefined;

  const linkyNamespace: Record<string, unknown> = {};
  if (clientAttribution) linkyNamespace.client = clientAttribution;

  const callerCopy: LinkyMetadata = {};
  if (caller) {
    for (const [key, value] of Object.entries(caller)) {
      if (key === "_linky") continue;
      callerCopy[key] = value;
    }
  }

  if (Object.keys(linkyNamespace).length > 0) {
    callerCopy._linky = linkyNamespace;
  }

  return Object.keys(callerCopy).length > 0 ? callerCopy : undefined;
}

async function insertWithRetry(
  payload: CreateLinkyPayload,
  attribution: AttributionFields,
  clientAttribution: string | undefined,
): Promise<LinkyRecord> {
  const mergedMetadata = mergeServerMetadata(
    payload.metadata,
    clientAttribution,
  );

  for (let attempt = 0; attempt < GENERATED_SLUG_ATTEMPTS; attempt += 1) {
    const created = await insertLinkyRecord({
      slug: generateSlug(),
      urls: payload.urls,
      urlMetadata: payload.urlMetadata ?? [],
      source: payload.source,
      metadata: mergedMetadata,
      title: payload.title ?? null,
      description: payload.description ?? null,
      ownerUserId: attribution.ownerUserId,
      ownerOrgId: attribution.ownerOrgId,
      creatorFingerprint: attribution.creatorFingerprint,
      resolutionPolicy: payload.resolutionPolicy ?? null,
    });

    if (created) return created;
  }

  throw new LinkyError("Failed to allocate a unique slug. Please retry.", {
    code: "INTERNAL_ERROR",
    statusCode: 500,
  });
}

export async function createLinky(
  input: CreateLinkyInput,
  subject: AuthSubject,
): Promise<CreateLinkyResult> {
  if (subject.type !== "anonymous") {
    requireScope(subject, "links:write");
  }

  const limits = getLimits(subject);
  if (input.urls.length > limits.maxUrlsPerLinky) {
    throw new LinkyError(
      `Your plan allows up to ${limits.maxUrlsPerLinky} URLs per Linky.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  const attribution = resolveAttribution(subject, input.clientIp, input.userAgent);

  const record = await insertWithRetry(input, attribution, input.clientAttribution);

  // Anonymous Linkies always get a claim token so the creator has a
  // frictionless path to bind the row to an account later. Signed-in
  // callers never need one — ownership is already attributed.
  if (subject.type === "anonymous") {
    const claim = await createClaimToken({
      linkyId: record.id,
      email: input.email ?? null,
    });
    return {
      slug: record.slug,
      record,
      claim: {
        token: claim.token,
        expiresAt: claim.expiresAt,
        warningMessage: CLAIM_WARNING_MESSAGE,
      },
    };
  }

  return { slug: record.slug, record };
}

// ---------------------------------------------------------------------------
// Read: get + list + versions.
// ---------------------------------------------------------------------------

export function toLinkyDto(record: LinkyRecord): LinkyDto {
  return {
    slug: record.slug,
    urls: record.urls,
    urlMetadata: record.urlMetadata,
    title: record.title,
    description: record.description,
    owner: record.owner,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source,
    metadata: record.metadata,
    resolutionPolicy: record.resolutionPolicy,
  };
}

export function toLinkyListItemDto(record: LinkyRecord): LinkyListItemDto {
  return {
    slug: record.slug,
    title: record.title,
    description: record.description,
    urls: record.urls,
    urlMetadata: record.urlMetadata,
    owner: record.owner,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    source: record.source,
  };
}

export function toLinkyVersionDto(version: LinkyVersionRecord): LinkyVersionDto {
  return {
    versionNumber: version.versionNumber,
    urls: version.urls,
    urlMetadata: version.urlMetadata,
    title: version.title,
    description: version.description,
    editedByClerkUserId: version.editedByClerkUserId,
    editedAt: version.editedAt,
  };
}

function notFound(): LinkyError {
  return new LinkyError("Linky not found.", {
    code: "NOT_FOUND",
    statusCode: 404,
  });
}

function ownershipOf(record: LinkyRecord): {
  ownerUserId: string | null;
  ownerOrgId: string | null;
} {
  return {
    ownerUserId: record.owner.type === "user" ? record.owner.userId : null,
    ownerOrgId: record.owner.type === "org" ? record.owner.orgId : null,
  };
}

export async function getLinky(
  input: { slug: string },
  subject: AuthenticatedSubject,
): Promise<LinkyDto> {
  requireScope(subject, "links:read");
  const record = await getLinkyRecordBySlug(input.slug);
  if (!record) throw notFound();

  requireCanViewLinky(subject, ownershipOf(record), roleOfSubject(subject));
  return toLinkyDto(record);
}

export type ListLinkiesInput = {
  limit: number;
  offset: number;
};

export type LinkyListResponse = {
  linkies: LinkyListItemDto[];
  pagination: { limit: number; offset: number };
  subject:
    | { type: "user"; userId: string }
    | { type: "org"; orgId: string };
};

const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 100;

export function parseListPagination(input: {
  limit?: number | string | null;
  offset?: number | string | null;
}): ListLinkiesInput {
  const parsedLimit =
    input.limit === undefined || input.limit === null || input.limit === ""
      ? DEFAULT_LIST_LIMIT
      : typeof input.limit === "number"
        ? input.limit
        : Number.parseInt(String(input.limit), 10);

  const parsedOffset =
    input.offset === undefined || input.offset === null || input.offset === ""
      ? 0
      : typeof input.offset === "number"
        ? input.offset
        : Number.parseInt(String(input.offset), 10);

  if (
    !Number.isFinite(parsedLimit) ||
    parsedLimit <= 0 ||
    parsedLimit > MAX_LIST_LIMIT
  ) {
    throw new LinkyError(
      `\`limit\` must be a positive integer <= ${MAX_LIST_LIMIT}.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  if (!Number.isFinite(parsedOffset) || parsedOffset < 0) {
    throw new LinkyError("`offset` must be a non-negative integer.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  return { limit: parsedLimit, offset: parsedOffset };
}

export async function listLinkies(
  input: ListLinkiesInput,
  subject: AuthenticatedSubject,
): Promise<LinkyListResponse> {
  requireScope(subject, "links:read");

  const records =
    subject.type === "org"
      ? await listLinkiesForSubject({
          type: "org",
          orgId: subject.orgId,
          limit: input.limit,
          offset: input.offset,
        })
      : await listLinkiesForSubject({
          type: "user",
          userId: subject.userId,
          limit: input.limit,
          offset: input.offset,
        });

  return {
    linkies: records.map(toLinkyListItemDto),
    pagination: { limit: input.limit, offset: input.offset },
    subject:
      subject.type === "org"
        ? { type: "org", orgId: subject.orgId }
        : { type: "user", userId: subject.userId },
  };
}

export type LinkyVersionsResponse = {
  versions: LinkyVersionDto[];
};

export async function getLinkyVersions(
  input: { slug: string },
  subject: AuthenticatedSubject,
): Promise<LinkyVersionsResponse> {
  requireScope(subject, "links:read");
  const record = await getLinkyRecordBySlug(input.slug);
  if (!record) throw notFound();

  requireCanViewLinky(subject, ownershipOf(record), roleOfSubject(subject));

  const versions = await listLinkyVersions(input.slug);
  return { versions: versions.map(toLinkyVersionDto) };
}

// ---------------------------------------------------------------------------
// Update.
// ---------------------------------------------------------------------------

export type UpdateLinkyInput = PatchLinkyPayload & {
  slug: string;
};

export async function updateLinky(
  input: UpdateLinkyInput,
  subject: AuthenticatedSubject,
): Promise<LinkyDto> {
  requireScope(subject, "links:write");

  const existing = await getLinkyRecordBySlug(input.slug);
  if (!existing) throw notFound();

  requireCanEditLinky(subject, ownershipOf(existing), roleOfSubject(subject));

  const { slug, ...patch } = input;
  const updated = await patchLinkyRecord({
    slug,
    patch,
    // API-key-authenticated org subjects may not carry a human user id. We
    // preserve the append-only history row anyway and leave the editor field
    // null rather than inventing a Clerk identity.
    editedByClerkUserId: subject.type === "user" ? subject.userId : subject.userId,
  });

  if (!updated) {
    // Row disappeared between read and patch (parallel DELETE landed
    // first). Surface as not-found to reflect reality.
    throw notFound();
  }

  return toLinkyDto(updated);
}

// ---------------------------------------------------------------------------
// Delete.
// ---------------------------------------------------------------------------

export type DeleteLinkyResult = {
  slug: string;
  deletedAt: string;
};

export async function deleteLinky(
  input: { slug: string },
  subject: AuthenticatedSubject,
): Promise<DeleteLinkyResult> {
  requireScope(subject, "links:write");

  const existing = await getLinkyRecordBySlug(input.slug);
  if (!existing) throw notFound();

  requireCanAdminLinky(subject, ownershipOf(existing), roleOfSubject(subject));

  await softDeleteLinkyRecord(input.slug);
  return { slug: input.slug, deletedAt: new Date().toISOString() };
}
