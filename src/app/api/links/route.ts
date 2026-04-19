import { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import {
  parseClientAttributionHeader,
  parseCreateLinkyPayload,
} from "@/lib/linky/schemas";
import type { CreateLinkyResponse, LinkyRecord } from "@/lib/linky/types";
import {
  AuthRequiredError,
  ForbiddenError,
  getAuthSubject,
} from "@/lib/server/auth";
import { getPublicBaseUrl, getRateLimitConfig } from "@/lib/server/config";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getClientIp } from "@/lib/server/request";
import {
  createLinky,
  type CreateLinkyResult,
} from "@/lib/server/services/linkies-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type KnownError = LinkyError | AuthRequiredError | ForbiddenError;

function isKnownError(error: unknown): error is KnownError {
  return (
    isLinkyError(error) ||
    error instanceof AuthRequiredError ||
    error instanceof ForbiddenError
  );
}

function toErrorResponse(error: KnownError): Response {
  const isInternal =
    isLinkyError(error) && error.code === "INTERNAL_ERROR";
  const publicMessage = isInternal
    ? "Linky is temporarily unavailable. Please try again shortly."
    : error.message;

  const details =
    isLinkyError(error) && process.env.NODE_ENV === "development"
      ? error.details
      : undefined;

  return Response.json(
    {
      error: publicMessage,
      code: error.code,
      details,
    },
    { status: error.statusCode },
  );
}

function buildCreateResponse(
  record: LinkyRecord,
  result: CreateLinkyResult,
  request: NextRequest,
): CreateLinkyResponse {
  const baseUrl = getPublicBaseUrl(request.nextUrl.origin);
  const url = new URL(`/l/${record.slug}`, baseUrl).toString();

  const response: CreateLinkyResponse = {
    slug: record.slug,
    url,
  };

  if (result.claim) {
    // We return BOTH the raw token and the pre-assembled URL so agents that
    // want to store the secret in a key-manager (and reassemble the URL
    // against a different base later, e.g. prod vs local) can do so cleanly.
    // The URL is a convenience; the token is the secret.
    response.claimUrl = new URL(
      `/claim/${result.claim.token}`,
      baseUrl,
    ).toString();
    response.claimExpiresAt = result.claim.expiresAt;
    response.claimToken = result.claim.token;
    response.warning = result.claim.warningMessage;
  }

  // Sprint 2.5: echo the persisted policy when one is attached. Saves
  // agents a second fetch to confirm server-minted rule ids.
  if (record.resolutionPolicy && record.resolutionPolicy.rules.length > 0) {
    response.resolutionPolicy = record.resolutionPolicy;
  }

  return response;
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
    const subject = await getAuthSubject(request);

    const clientAttribution = parseClientAttributionHeader(
      request.headers.get("linky-client"),
    );

    const result = await createLinky(
      {
        ...payload,
        clientIp,
        userAgent: request.headers.get("user-agent"),
        clientAttribution,
      },
      subject,
    );

    const response = buildCreateResponse(result.record, result, request);
    return Response.json(response, { status: 201 });
  } catch (error) {
    if (isKnownError(error)) return toErrorResponse(error);

    return toErrorResponse(
      new LinkyError("Unexpected server error while creating Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
