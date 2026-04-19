import type { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import {
  AuthRequiredError,
  ForbiddenError,
  requireAuthSubject,
} from "@/lib/server/auth";
import { getLinkyInsights } from "@/lib/server/services/insights-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ slug: string }>;
};

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

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const subject = await requireAuthSubject(request);

    const dto = await getLinkyInsights(
      { slug, range: request.nextUrl.searchParams.get("range") },
      subject,
    );

    return Response.json(dto);
  } catch (error) {
    if (isKnownError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError("Unexpected server error while loading insights.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
