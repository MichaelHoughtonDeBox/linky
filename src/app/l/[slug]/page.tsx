import { notFound } from "next/navigation";

import { evaluatePolicy, isEmptyPolicy } from "@/lib/linky/policy";
import { getPublicBaseUrl } from "@/lib/server/config";
import { getLinkyRecordBySlug } from "@/lib/server/linkies-repository";
import { buildViewerContext } from "@/lib/server/viewer-context";

import { LinkyLauncher } from "./launcher-client";
import { LinkyResolverError } from "./resolver-error";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type LinkySlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function LinkySlugPage({ params }: LinkySlugPageProps) {
  let slug: string;

  try {
    ({ slug } = await params);
  } catch {
    return <LinkyResolverError />;
  }

  let linky: Awaited<ReturnType<typeof getLinkyRecordBySlug>>;
  try {
    linky = await getLinkyRecordBySlug(slug);
  } catch {
    return <LinkyResolverError />;
  }

  if (!linky) {
    notFound();
  }

  // Sprint 2 — identity-aware resolution.
  //
  // Empty policies short-circuit: skip Clerk entirely and serve the public
  // fallback URLs as-is (plan §4, semantics #5). This is the dominant case
  // today and keeps the resolver path fast for high-traffic public Linkies.
  //
  // When a policy exists, we build a `ViewerContext` from Clerk and pass it
  // to the pure evaluator. The policy itself is NEVER shipped to the client;
  // only the resolved tab set + match metadata.
  const policyActive = !isEmptyPolicy(linky.resolutionPolicy);

  let resolvedTabs = linky.urls.map((url) => ({ url }));
  let matchedRuleId: string | null = null;
  let matchedRuleName: string | null = null;
  let viewerLabel: string | null = null;
  let viewerIsAnonymous = true;

  if (policyActive) {
    try {
      const viewer = await buildViewerContext();
      viewerIsAnonymous = viewer.anonymous;
      viewerLabel = viewer.email ?? null;

      const result = evaluatePolicy(
        linky.resolutionPolicy,
        viewer,
        linky.urls,
      );
      resolvedTabs = result.tabs;
      matchedRuleId = result.matchedRuleId;
      matchedRuleName = result.matchedRuleName;
    } catch {
      // Resolver failures must never break the launcher. Fall through to
      // the public URL set so the link still works — we just don't show a
      // personalized banner.
      resolvedTabs = linky.urls.map((url) => ({ url }));
      matchedRuleId = null;
      matchedRuleName = null;
    }
  }

  return (
    <LinkyLauncher
      slug={linky.slug}
      urls={resolvedTabs.map((tab) => tab.url)}
      createdAt={linky.createdAt}
      baseUrl={getPublicBaseUrl()}
      policyActive={policyActive}
      viewerIsAnonymous={viewerIsAnonymous}
      viewerLabel={viewerLabel}
      matchedRuleId={matchedRuleId}
      matchedRuleName={matchedRuleName}
    />
  );
}
