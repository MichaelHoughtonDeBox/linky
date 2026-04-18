import type { NextRequest } from "next/server";

import { LinkyError, isLinkyError } from "@/lib/linky/errors";
import type { ResolutionPolicy } from "@/lib/linky/policy";
import {
  AuthRequiredError,
  ForbiddenError,
  requireAuthSubject,
  requireCanViewLinky,
  roleOfSubject,
} from "@/lib/server/auth";
import {
  aggregateLauncherInsights,
  resolveInsightsRange,
  type InsightsByRule,
  type LauncherInsights,
} from "@/lib/server/launcher-events-repository";
import { getLinkyRecordBySlug } from "@/lib/server/linkies-repository";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// ============================================================================
// GET /api/links/:slug/insights?range=7d|30d|90d
//
// Sprint 2.7 Chunk B. Owner-side analytics DTO. Answers two questions:
//
//   1. Did my audience arrive?  (totals.views / uniqueViewerDays /
//      openAllRate + the per-day sparkline in `series`)
//   2. Is my policy working?    (byRule breakdown with rule names
//      resolved from the CURRENT policy; dangling ids render as
//      "(removed rule)" so deleted rules still surface their history)
//
// Gated on `canViewLinky` so every role (viewer / editor / admin) can
// see the numbers. Writes stay gated on edit/admin roles in the other
// routes.
//
// Range caps at 90d for this sprint. Longer retention + paid-plan gating
// ships with Sprint 3 when the `entitlements` story lands.
// ============================================================================

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

type ByRuleDto = InsightsByRule & {
  // Human-readable label. Resolved from the current policy at request
  // time — never persisted on the event row. Dangling rule ids (rule was
  // deleted after the event was captured) render as "(removed rule)".
  ruleName: string;
};

function resolveRuleName(
  ruleId: string | null,
  policy: ResolutionPolicy | null | undefined,
): string {
  if (ruleId === null) return "Fallthrough";
  if (!policy) return "(removed rule)";

  const match = policy.rules.find((rule) => rule.id === ruleId);
  if (!match) return "(removed rule)";

  // Rule `name` is optional at policy author time; render a reasonable
  // default so the UI never shows an empty cell. We DO NOT gate this on
  // `showBadge` — that flag controls what the VIEWER sees at /l/[slug];
  // the owner looking at their own insights sees every rule name
  // regardless.
  return match.name?.trim() || `Rule ${match.id.slice(0, 8)}`;
}

function toResponseDto(
  slug: string,
  insights: LauncherInsights,
  policy: ResolutionPolicy | null | undefined,
) {
  const byRule: ByRuleDto[] = insights.byRule.map((bucket) => ({
    ...bucket,
    ruleName: resolveRuleName(bucket.ruleId, policy),
  }));

  return {
    slug,
    range: insights.range,
    totals: insights.totals,
    byRule,
    series: insights.series,
  };
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<Response> {
  try {
    const { slug } = await context.params;
    const subject = await requireAuthSubject(request);

    const linky = await getLinkyRecordBySlug(slug);
    if (!linky) {
      return Response.json(
        { error: "Linky not found.", code: "NOT_FOUND" },
        { status: 404 },
      );
    }

    requireCanViewLinky(
      subject,
      {
        ownerUserId:
          linky.owner.type === "user" ? linky.owner.userId : null,
        ownerOrgId:
          linky.owner.type === "org" ? linky.owner.orgId : null,
      },
      roleOfSubject(subject),
    );

    const range = resolveInsightsRange(
      request.nextUrl.searchParams.get("range"),
    );

    const insights = await aggregateLauncherInsights({
      linkyId: linky.id,
      range,
    });

    return Response.json(toResponseDto(slug, insights, linky.resolutionPolicy));
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
