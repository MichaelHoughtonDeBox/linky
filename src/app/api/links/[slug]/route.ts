import type { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import { parsePatchLinkyPayload } from "@/lib/linky/schemas";
import type { LinkyRecord } from "@/lib/linky/types";
import {
  AuthRequiredError,
  ForbiddenError,
  requireAuthSubject,
  requireCanEditLinky,
} from "@/lib/server/auth";
import {
  getLinkyRecordBySlug,
  patchLinkyRecord,
  softDeleteLinkyRecord,
} from "@/lib/server/linkies-repository";

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

function toRecordDto(record: LinkyRecord) {
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
    // Sprint 2: the DTO includes the full policy so the dashboard editor
    // can round-trip without a second read. Safe because PATCH is owner-only
    // (ownership is enforced by `requireCanEditLinky` above). The public
    // `/l/[slug]` launcher never ships the policy to the client — it only
    // forwards the resolved tab set.
    resolutionPolicy: record.resolutionPolicy,
  };
}

// ---------------------------------------------------------------------------
// PATCH: owner-only edit. Anonymous Linkies reject with 403.
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;

    const subject = await requireAuthSubject();

    const existing = await getLinkyRecordBySlug(slug);
    if (!existing) {
      return Response.json(
        { error: "Linky not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    // Owner check lives at the repository boundary so any future caller
    // (CLI, SDK, dashboard) hits the same guard.
    requireCanEditLinky(subject, {
      ownerUserId:
        existing.owner.type === "user" ? existing.owner.userId : null,
      ownerOrgId:
        existing.owner.type === "org" ? existing.owner.orgId : null,
    });

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

    const updated = await patchLinkyRecord({
      slug,
      patch,
      editedByClerkUserId: subject.userId,
    });

    if (!updated) {
      // Row disappeared between read and patch; rare but possible if a
      // parallel DELETE landed first. Return 404 to reflect reality.
      return Response.json(
        { error: "Linky not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    return Response.json({ linky: toRecordDto(updated) });
  } catch (error) {
    if (isKnownError(error)) {
      return toErrorResponse(error);
    }
    return toErrorResponse(
      new LinkyError("Unexpected server error while updating Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE: owner-only soft delete. Public resolver responds 410 afterwards.
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;

    const subject = await requireAuthSubject();

    const existing = await getLinkyRecordBySlug(slug);
    if (!existing) {
      return Response.json(
        { error: "Linky not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    requireCanEditLinky(subject, {
      ownerUserId:
        existing.owner.type === "user" ? existing.owner.userId : null,
      ownerOrgId:
        existing.owner.type === "org" ? existing.owner.orgId : null,
    });

    await softDeleteLinkyRecord(slug);
    return Response.json({ ok: true });
  } catch (error) {
    if (isKnownError(error)) {
      return toErrorResponse(error);
    }
    return toErrorResponse(
      new LinkyError("Unexpected server error while deleting Linky.", {
        code: "INTERNAL_ERROR",
        statusCode: 500,
      }),
    );
  }
}
