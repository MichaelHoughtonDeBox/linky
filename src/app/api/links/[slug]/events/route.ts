import type { NextRequest } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import { getRateLimitConfig } from "@/lib/server/config";
import { recordOpenAll } from "@/lib/server/launcher-events-repository";
import { getLinkyRecordBySlug } from "@/lib/server/linkies-repository";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { getClientIp } from "@/lib/server/request";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================================
// POST /api/links/:slug/events — Sprint 2.7 Chunk A.
//
// Public endpoint (anyone clicking Open All). Deliberate design:
//
//   - No auth. The launcher page is public; so is the event it emits.
//   - IP-rate-limited to the same bucket as `POST /api/links` — same-origin
//     click storms cannot DoS the table.
//   - Best-effort write. A DB outage or a missing daily salt returns 204
//     anyway; the client button has already done its job (opened the tabs).
//   - We deliberately do NOT echo the event back. No tracking IDs, no
//     client-side analytics cookie. Matches the low-surveillance posture.
//
// Body shape (all optional):
//   { "kind": "open_all", "matchedRuleId": "01J..." | null }
//
// `kind` accepts only "open_all" in Chunk A. Future expansion (e.g.
// "open_one" with a URL index) rides on the same route.
// ============================================================================

type RouteContext = {
  params: Promise<{ slug: string }>;
};

type EventBody = {
  kind: "open_all";
  matchedRuleId: string | null;
};

function parseBody(raw: unknown): EventBody {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new LinkyError("Request body must be an object.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const obj = raw as Record<string, unknown>;
  const kind = obj.kind;
  if (kind !== "open_all") {
    throw new LinkyError("`kind` must be 'open_all'.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const matchedRuleId = obj.matchedRuleId;
  if (
    matchedRuleId !== null &&
    matchedRuleId !== undefined &&
    typeof matchedRuleId !== "string"
  ) {
    throw new LinkyError("`matchedRuleId` must be a string or null.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  return {
    kind: "open_all",
    matchedRuleId: typeof matchedRuleId === "string" ? matchedRuleId : null,
  };
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;

    const rateConfig = getRateLimitConfig();
    const clientIp = getClientIp(request);
    const rateLimit = checkRateLimit(`events:${clientIp}`, rateConfig);

    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: "Too many requests. Please try again shortly.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": `${rateLimit.retryAfterSeconds}` },
        },
      );
    }

    let rawBody: unknown = {};
    try {
      // Empty body is fine — browsers often fire navigator.sendBeacon with
      // no payload. Treat missing JSON as `{ kind: "open_all", matchedRuleId: null }`.
      const text = await request.text();
      rawBody = text ? JSON.parse(text) : { kind: "open_all" };
    } catch {
      throw new LinkyError("Request body must be valid JSON.", {
        code: "INVALID_JSON",
        statusCode: 400,
      });
    }

    const body = parseBody(rawBody);

    // Resolve the Linky first so a stale client can't write events against
    // a slug that never existed (or a soft-deleted one).
    const linky = await getLinkyRecordBySlug(slug);
    if (!linky) {
      // 204 instead of 404: the event is best-effort, and a 404 leaks
      // slug existence to any client that knows the URL pattern. The
      // launcher itself already returned 404 if the Linky was gone.
      return new Response(null, { status: 204 });
    }

    const session = await auth();

    // Best-effort. The repo swallows its own DB errors; we also swallow
    // anything the repo re-throws so a broken analytics path never
    // surfaces to the caller.
    try {
      await recordOpenAll({
        linkyId: linky.id,
        matchContext: { matchedRuleId: body.matchedRuleId },
        clerkUserId: session.userId ?? null,
        clientIp,
      });
    } catch (error) {
      console.error("[events] recordOpenAll failed:", error);
    }

    return new Response(null, { status: 204 });
  } catch (error) {
    if (isLinkyError(error)) {
      return Response.json(
        { error: error.message, code: error.code },
        { status: error.statusCode },
      );
    }
    // Never leak analytics internals to the caller. 500 with a generic
    // message; the launcher button has already done its real job.
    return Response.json(
      {
        error: "Linky is temporarily unavailable. Please try again shortly.",
        code: "INTERNAL_ERROR",
      },
      { status: 500 },
    );
  }
}
