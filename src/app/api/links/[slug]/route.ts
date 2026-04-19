import type { NextRequest } from "next/server";

import { LinkyError } from "@/lib/linky/errors";
import { parsePatchLinkyPayload } from "@/lib/linky/schemas";
import { requireAuthSubject } from "@/lib/server/auth";
import { isKnownServerError, toErrorResponse } from "@/lib/server/http-errors";
import {
  deleteLinky,
  getLinky,
  updateLinky,
} from "@/lib/server/services/linkies-service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Next.js 16: dynamic `params` is a Promise and must be awaited.
// See node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md
type RouteContext = {
  params: Promise<{ slug: string }>;
};

// Sprint 2.8 post-launch fix — Bug #1: the SDK `LinkyClient.getLinky()`
// and the CLI `linky get <slug>` both assumed this endpoint existed. The
// MCP tool `linky_get` worked because it calls the service layer directly,
// but every external transport (SDK, CLI, raw HTTP) was 405ing. The SDK
// source even had a comment predicting this: *"Chunk A adds a GET
// /api/links/:slug endpoint. Until then this method is still present so
// Chunk A can wire the route without a SDK shape break."* Chunk A never
// wired it. This is that wiring.
export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const subject = await requireAuthSubject(request);
    const dto = await getLinky({ slug }, subject);
    // Raw DTO (not `{linky: dto}`) because the SDK's `LinkyClient.getLinky()`
    // treats the response as the DTO directly — see sdk/client.test.js and
    // cli/linkies.test.js which both fixture the unwrapped shape. The PATCH
    // path still wraps in `{linky: dto}` for historical compat; changing
    // that would break existing callers. GET is a new endpoint, so it
    // matches the SDK consumer expectation instead.
    return Response.json(dto);
  } catch (error) {
    if (isKnownServerError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError("Unexpected server error while reading Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
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
    if (isKnownServerError(error)) return toErrorResponse(error);
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
    if (isKnownServerError(error)) return toErrorResponse(error);
    return toErrorResponse(
      new LinkyError("Unexpected server error while deleting Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
