import type { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import {
  AuthRequiredError,
  ForbiddenError,
  requireAuthSubject,
} from "@/lib/server/auth";
import {
  listLinkies,
  parseListPagination,
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
  const publicMessage =
    isLinkyError(error) && error.code === "INTERNAL_ERROR"
      ? "Linky is temporarily unavailable. Please try again shortly."
      : error.message;

  return Response.json(
    { error: publicMessage, code: error.code },
    { status: error.statusCode },
  );
}

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const subject = await requireAuthSubject(request);
    const pagination = parseListPagination({
      limit: request.nextUrl.searchParams.get("limit"),
      offset: request.nextUrl.searchParams.get("offset"),
    });

    const dto = await listLinkies(pagination, subject);
    return Response.json(dto);
  } catch (error) {
    if (isKnownError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError(
        "Unexpected server error while listing your Linky bundles.",
        { code: "INTERNAL_ERROR", statusCode: 500 },
      ),
    );
  }
}
