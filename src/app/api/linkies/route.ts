import { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import { parseCreateLinkyPayload } from "@/lib/linky/schemas";
import { generateSlug } from "@/lib/linky/slugs";
import type {
  CreateLinkyPayload,
  CreateLinkyResponse,
  LinkyRecord,
} from "@/lib/linky/types";
import { getPublicBaseUrl, getRateLimitConfig } from "@/lib/server/config";
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
      // Internal details are useful in dev but should not leak in normal responses.
      details: process.env.NODE_ENV === "development" ? error.details : undefined,
    },
    { status: error.statusCode },
  );
}

function buildCreateResponse(
  record: LinkyRecord,
  request: NextRequest,
): CreateLinkyResponse {
  const baseUrl = getPublicBaseUrl(request.nextUrl.origin);
  const url = new URL(`/l/${record.slug}`, baseUrl).toString();

  return {
    slug: record.slug,
    url,
  };
}

async function createLinkyRecord(payload: CreateLinkyPayload): Promise<LinkyRecord> {
  // We retry generated slugs in case of rare random collisions.
  for (let attempt = 0; attempt < GENERATED_SLUG_ATTEMPTS; attempt += 1) {
    const created = await insertLinkyRecord({
      slug: generateSlug(),
      urls: payload.urls,
      source: payload.source,
      metadata: payload.metadata,
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
    const rateLimitKey = getClientIp(request);
    const rateLimit = checkRateLimit(rateLimitKey, rateConfig);

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
    const record = await createLinkyRecord(payload);
    const response = buildCreateResponse(record, request);

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
