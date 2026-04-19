import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { after } from "next/server";

import { auth } from "@clerk/nextjs/server";

import { evaluatePolicy, isEmptyPolicy } from "@/lib/linky/policy";
import { getPublicBaseUrl } from "@/lib/server/config";
import { recordView } from "@/lib/server/launcher-events-repository";
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

  // Sprint 2.7 Chunk A — owner-side analytics write.
  //
  // Fire-and-forget via Next 16's `after()`: the launcher HTML streams to
  // the viewer first, the event insert runs after the response has closed.
  // A DB outage or a missing LINKY_DAILY_SALT cannot delay or 500 the
  // launcher — the repo swallows its own errors defensively.
  //
  // Sprint 2.8 post-launch fix — Bug #3: the original implementation
  // called `headers()` and `auth()` INSIDE the `after()` callback. In
  // Next.js 16 both are request-scoped and reject once the response has
  // closed, which happens before `after()` runs. The try/catch around the
  // callback swallowed the rejection and logged to stderr, so view events
  // silently dropped 100% of the time. The `open_all` path worked because
  // it comes in as a fresh POST request with its own request context.
  //
  // Fix: resolve the request-scoped values (`clientIp`, `clerkUserId`)
  // BEFORE calling `after()`, then pass them in as closure values so the
  // callback has everything it needs without touching the request store.
  const requestHeaders = await headers();
  const forwardedForHeader = requestHeaders.get("x-forwarded-for") ?? "";
  const clientIp =
    forwardedForHeader.split(",")[0]?.trim() ||
    requestHeaders.get("x-real-ip")?.trim() ||
    "unknown";
  const session = await auth();
  const viewerClerkUserId = session.userId ?? null;

  after(async () => {
    try {
      await recordView({
        linkyId: linky.id,
        matchContext: { matchedRuleId },
        clerkUserId: viewerClerkUserId,
        clientIp,
      });
    } catch (error) {
      console.error("[launcher] view-event after() failed:", error);
    }
  });

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
