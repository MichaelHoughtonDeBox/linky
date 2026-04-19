import type { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import { parsePatchLinkyPayload } from "@/lib/linky/schemas";
import {
  AuthRequiredError,
  ForbiddenError,
  requireAuthSubject,
} from "@/lib/server/auth";
import {
  deleteLinky,
  updateLinky,
} from "@/lib/server/services/linkies-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next.js 16: dynamic `params` is a Promise and must be awaited.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
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
  const statusCode = error.statusCode;
  const isInternal = isLinkyError(error) && error.code === "INTERNAL_ERROR";
  const publicMessage = isInternal
    ? "Linky is temporarily unavailable. Please try again shortly."
    : error.message;

  return Response.json(
    {
      error: publicMessage,
      code: error.code,
      details:
        process.env.NODE_ENV === "development" && isLinkyError(error)
          ? error.details
          : undefined,
    },
    { status: statusCode },
  );
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const subject = await requireAuthSubject(request);

    let rawPayload: unknown;
    try {
      rawPayload = await request.json();
    } catch {
      throw new LinkyError("Request body must be valid JSON.", {
        code: "INVALID_JSON",
        statusCode: 400,
      });
    }

    const patch = parsePatchLinkyPayload(rawPayload);
    const dto = await updateLinky({ ...patch, slug }, subject);

    return Response.json({ linky: dto });
  } catch (error) {
    if (isKnownError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError("Unexpected server error while updating Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const subject = await requireAuthSubject(request);

    await deleteLinky({ slug }, subject);

    return Response.json({ ok: true });
  } catch (error) {
    if (isKnownError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError("Unexpected server error while deleting Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
