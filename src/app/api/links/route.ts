import { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import {
  parseClientAttributionHeader,
  parseCreateLinkyPayload,
} from "@/lib/linky/schemas";
import { generateSlug } from "@/lib/linky/slugs";
import type {
  CreateLinkyPayload,
  CreateLinkyResponse,
  LinkyMetadata,
  LinkyRecord,
} from "@/lib/linky/types";
import { getAuthSubject, type AuthSubject } from "@/lib/server/auth";
import { createClaimToken } from "@/lib/server/claim-tokens";
import { getPublicBaseUrl, getRateLimitConfig } from "@/lib/server/config";
import { getLimits } from "@/lib/server/entitlements";
import { computeCreatorFingerprint } from "@/lib/server/fingerprint";
import { insertLinkyRecord } from "@/lib/server/linkies-repository";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getClientIp } from "@/lib/server/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GENERATED_SLUG_ATTEMPTS = 5;

function toErrorResponse(error: LinkyError): Response {
  const isInternal = error.code === "INTERNAL_ERROR";
  const publicMessage = isInternal
    ? "Linky is temporarily unavailable. Please try again shortly."
    : error.message;

  return Response.json(
    {
      error: publicMessage,
      code: error.code,
      details: process.env.NODE_ENV === "development" ? error.details : undefined,
    },
    { status: error.statusCode },
  );
}

const CLAIM_WARNING_MESSAGE =
  "Save claimToken and claimUrl now — they are returned only once and cannot be recovered. If you lose them, the anonymous Linky stays public but can never be bound to an account.";

function buildCreateResponse(
  record: LinkyRecord,
  request: NextRequest,
  claim?: { token: string; expiresAt: string },
): CreateLinkyResponse {
  const baseUrl = getPublicBaseUrl(request.nextUrl.origin);
  const url = new URL(`/l/${record.slug}`, baseUrl).toString();

  const response: CreateLinkyResponse = {
    slug: record.slug,
    url,
  };

  if (claim) {
    // We return BOTH the raw token and the pre-assembled URL so agents that
    // want to store the secret in a key-manager (and reassemble the URL
    // against a different base later, e.g. prod vs local) can do so cleanly.
    // The URL is a convenience; the token is the secret.
    response.claimUrl = new URL(`/claim/${claim.token}`, baseUrl).toString();
    response.claimExpiresAt = claim.expiresAt;
    response.claimToken = claim.token;
    response.warning = CLAIM_WARNING_MESSAGE;
  }

  return response;
}

// ---------------------------------------------------------------------------
// Ownership + fingerprint attribution.
//
// - Org context wins over user context (team plan > solo).
// - Anonymous creates stay anonymous, but we still capture a fingerprint
//   so the creator can later claim the Linky through the claim-token flow.
// ---------------------------------------------------------------------------

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
// user-supplied metadata without clobbering user keys. Our fields live under
// the reserved `_linky` namespace; anything outside that namespace is the
// caller's to own. If a caller tries to supply `_linky` themselves, we
// discard their version — clients should NOT be able to forge attribution.
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
      // Drop any caller attempt to write into the reserved namespace.
      if (key === "_linky") continue;
      callerCopy[key] = value;
    }
  }

  if (Object.keys(linkyNamespace).length > 0) {
    callerCopy._linky = linkyNamespace;
  }

  return Object.keys(callerCopy).length > 0 ? callerCopy : undefined;
}

async function createLinkyRecord(
  payload: CreateLinkyPayload,
  attribution: AttributionFields,
  clientAttribution: string | undefined,
): Promise<LinkyRecord> {
  const mergedMetadata = mergeServerMetadata(payload.metadata, clientAttribution);

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
    });

    if (created) {
      return created;
    }
  }

  throw new LinkyError("Failed to allocate a unique slug. Please retry.", {
    code: "INTERNAL_ERROR",
    statusCode: 500,
  });
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const rateConfig = getRateLimitConfig();
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(clientIp, rateConfig);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: "Too many requests. Please try again shortly.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: {
            "Retry-After": `${rateLimit.retryAfterSeconds}`,
          },
        },
      );
    }

    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      throw new LinkyError("Request body must be valid JSON.", {
        code: "INVALID_JSON",
        statusCode: 400,
      });
    }

    const payload = parseCreateLinkyPayload(rawPayload);

    const subject = await getAuthSubject();
    const limits = getLimits(subject);

    if (payload.urls.length > limits.maxUrlsPerLinky) {
      throw new LinkyError(
        `Your plan allows up to ${limits.maxUrlsPerLinky} URLs per Linky.`,
        { code: "BAD_REQUEST", statusCode: 400 },
      );
    }

    const attribution = resolveAttribution(
      subject,
      clientIp,
      request.headers.get("user-agent"),
    );

    // Optional `Linky-Client: cursor/skill-v1` attribution for ops
    // debugging. Malformed values are silently dropped rather than
    // rejecting the whole request — a bad client header should never
    // break an agent workflow.
    const clientAttribution = parseClientAttributionHeader(
      request.headers.get("linky-client"),
    );

    const record = await createLinkyRecord(
      payload,
      attribution,
      clientAttribution,
    );

    // Mint a claim token iff the Linky ended up anonymous. Signed-in
    // callers already have ownership attributed; minting a token for them
    // would be noise. Anonymous callers ALWAYS get a claim URL back so
    // they have a frictionless path to bind the Linky to an account later,
    // even if they didn't pass an email.
    const claim =
      subject.type === "anonymous"
        ? await createClaimToken({
            linkyId: record.id,
            email: payload.email ?? null,
          })
        : null;

    const response = buildCreateResponse(
      record,
      request,
      claim
        ? { token: claim.token, expiresAt: claim.expiresAt }
        : undefined,
    );

    return Response.json(response, { status: 201 });
  } catch (error) {
    if (isLinkyError(error)) {
      return toErrorResponse(error);
    }

    return toErrorResponse(
      new LinkyError("Unexpected server error while creating Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
