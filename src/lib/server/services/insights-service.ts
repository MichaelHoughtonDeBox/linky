import "server-only";

import { LinkyError } from "@/lib/linky/errors";
import type { ResolutionPolicy } from "@/lib/linky/policy";
import {
  requireCanViewLinky,
  requireScope,
  roleOfSubject,
  type AuthenticatedSubject,
} from "@/lib/server/auth";
import {
  aggregateLauncherInsights,
  resolveInsightsRange,
  type InsightsByRule,
  type InsightsRange,
  type InsightsSeriesPoint,
  type InsightsTotals,
  type LauncherInsights,
} from "@/lib/server/launcher-events-repository";
import { getLinkyRecordBySlug } from "@/lib/server/linkies-repository";

// ============================================================================
// Insights service — Sprint 2.8 Chunk 0.
//
// Owner-only analytics DTO builder. The route was ~50 lines of auth +
// range parsing + rule-name resolution + DTO shaping. All of that moves
// here so the MCP tool handler can call into exactly the same logic.
//
// The `ruleName` field is resolved from the CURRENT policy — dangling ids
// (rule was deleted after the event was captured) render as "(removed
// rule)" so deleted rules still surface their history. `null` rule id is
// the fallthrough bucket.
// ============================================================================

export type InsightsByRuleDto = InsightsByRule & {
  ruleName: string;
};

export type LauncherInsightsDto = {
  slug: string;
  range: LauncherInsights["range"];
  totals: InsightsTotals;
  byRule: InsightsByRuleDto[];
  series: InsightsSeriesPoint[];
};

export type GetLinkyInsightsInput = {
  slug: string;
  range?: InsightsRange | string | null;
};

function resolveRuleName(
  ruleId: string | null,
  policy: ResolutionPolicy | null | undefined,
): string {
  if (ruleId === null) return "Fallthrough";
  if (!policy) return "(removed rule)";

  const match = policy.rules.find((rule) => rule.id === ruleId);
  if (!match) return "(removed rule)";

  // Rule `name` is optional at policy author time. Render a short default
  // so the UI never shows an empty cell. We do NOT gate on `showBadge` —
  // that flag controls what the VIEWER sees at /l/[slug]; the owner
  // looking at their own insights sees every rule name regardless.
  return match.name?.trim() || `Rule ${match.id.slice(0, 8)}`;
}

function buildDto(
  slug: string,
  insights: LauncherInsights,
  policy: ResolutionPolicy | null | undefined,
): LauncherInsightsDto {
  const byRule: InsightsByRuleDto[] = insights.byRule.map((bucket) => ({
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

export async function getLinkyInsights(
  input: GetLinkyInsightsInput,
  subject: AuthenticatedSubject,
): Promise<LauncherInsightsDto> {
  requireScope(subject, "links:read");

  const record = await getLinkyRecordBySlug(input.slug);
  if (!record) {
    throw new LinkyError("Linky not found.", {
      code: "NOT_FOUND",
      statusCode: 404,
    });
  }

  requireCanViewLinky(
    subject,
    {
      ownerUserId: record.owner.type === "user" ? record.owner.userId : null,
      ownerOrgId: record.owner.type === "org" ? record.owner.orgId : null,
    },
    roleOfSubject(subject),
  );

  const range = resolveInsightsRange(
    typeof input.range === "string" ? input.range : null,
  );

  const insights = await aggregateLauncherInsights({
    linkyId: record.id,
    range,
  });

  return buildDto(input.slug, insights, record.resolutionPolicy);
}
