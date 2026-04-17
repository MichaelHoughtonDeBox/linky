import "server-only";

import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";

import type { ViewerContext } from "@/lib/linky/policy";

// ============================================================================
// Viewer context — build a `ViewerContext` from the current Clerk session.
//
// This module is the bridge between Clerk's Backend User shape and the DSL's
// pure `ViewerContext`. Two layers:
//
//   1. `buildViewerContext()`  — server-only. Calls Clerk. Cached per
//                                request. Returns the anonymous context
//                                when no session is present.
//
//   2. `mapClerkToViewerContext(...)` — pure. Takes the raw Clerk shapes
//                                (user + membership list) and projects them
//                                onto the DSL fields. Tested directly with
//                                fake in-memory objects in
//                                `viewer-context.test.ts`.
//
// The separation is deliberate: we do NOT want tests to import Clerk, but we
// DO want tests to exercise the provider-name mapping (`oauth_github` →
// `githubLogin`) and the plural-memberships flattening, since those are the
// surfaces that will silently drift if Clerk renames fields in a future
// major. See also plan §4: "Missing fields never throw."
// ============================================================================

// Minimal structural shapes we need from Clerk. Keep these narrow —
// anything more and we're fighting Clerk's class exports in vitest.
//
// NOTE: Field names mirror Clerk's Backend API verbatim. If Clerk renames
// `provider` → `providerId` (or similar) in a breaking release, the tests
// in `viewer-context.test.ts` must catch the drift before we silently stop
// populating `githubLogin` / `googleEmail`.

export type ClerkEmailLike = {
  id: string;
  emailAddress: string;
};

export type ClerkExternalAccountLike = {
  provider: string;
  emailAddress?: string | null;
  username?: string | null;
};

export type ClerkUserLike = {
  id: string;
  primaryEmailAddressId: string | null;
  emailAddresses: ClerkEmailLike[];
  externalAccounts: ClerkExternalAccountLike[];
};

export type ClerkMembershipLike = {
  organization: {
    id: string;
    slug: string | null;
  };
};

// ---------------------------------------------------------------------------
// Pure mapper.
// ---------------------------------------------------------------------------

/**
 * Project Clerk's raw User + membership list onto the policy DSL's
 * `ViewerContext`. Pure — no network, no clock, no env reads. Safe to call
 * from tests with fake shapes.
 *
 * Contract:
 *   - `orgIds` / `orgSlugs` reflect the viewer's FULL membership set.
 *     Not the active workspace. Sprint 2 requirement: rules like
 *     `{ "op": "in", "field": "orgSlugs", "value": ["acme"] }` must match
 *     from any navigation context.
 *   - Missing primary-email gracefully falls through — `email`,
 *     `emailDomain`, and any rule depending on them will return `false`
 *     at eval time rather than throwing.
 *   - External-account provider names:
 *       `oauth_github` → `githubLogin` (from `username`)
 *       `oauth_google` → `googleEmail` (from `emailAddress`)
 *     Unknown providers are silently ignored. If Clerk ever drops the
 *     `oauth_` prefix, `viewer-context.test.ts` will turn red and we'll
 *     see it before production.
 */
export function mapClerkToViewerContext(
  user: ClerkUserLike | null,
  memberships: ClerkMembershipLike[] = [],
): ViewerContext {
  if (!user) {
    return { anonymous: true, orgIds: [], orgSlugs: [] };
  }

  const email = pickPrimaryEmail(user);
  const emailDomain = email ? extractEmailDomain(email) : undefined;
  const github = findExternalAccount(user.externalAccounts, "oauth_github");
  const google = findExternalAccount(user.externalAccounts, "oauth_google");

  const orgIds: string[] = [];
  const orgSlugs: string[] = [];
  for (const membership of memberships) {
    if (!membership?.organization) continue;
    if (membership.organization.id) orgIds.push(membership.organization.id);
    if (membership.organization.slug) orgSlugs.push(membership.organization.slug);
  }

  const viewer: ViewerContext = {
    anonymous: false,
    userId: user.id,
    orgIds: dedupe(orgIds),
    orgSlugs: dedupe(orgSlugs),
  };

  if (email) viewer.email = email;
  if (emailDomain) viewer.emailDomain = emailDomain;

  const githubLogin = github?.username?.trim() || undefined;
  if (githubLogin) viewer.githubLogin = githubLogin;

  const googleEmail = google?.emailAddress?.trim()?.toLowerCase() || undefined;
  if (googleEmail) viewer.googleEmail = googleEmail;

  return viewer;
}

function pickPrimaryEmail(user: ClerkUserLike): string | undefined {
  if (user.primaryEmailAddressId) {
    const match = user.emailAddresses.find(
      (entry) => entry.id === user.primaryEmailAddressId,
    );
    if (match?.emailAddress) return match.emailAddress.toLowerCase();
  }
  const first = user.emailAddresses[0]?.emailAddress;
  return first ? first.toLowerCase() : undefined;
}

function extractEmailDomain(email: string): string | undefined {
  const at = email.lastIndexOf("@");
  if (at === -1 || at === email.length - 1) return undefined;
  return email.slice(at + 1).toLowerCase();
}

function findExternalAccount(
  accounts: ClerkExternalAccountLike[],
  provider: string,
): ClerkExternalAccountLike | undefined {
  return accounts.find((entry) => entry.provider === provider);
}

function dedupe(input: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of input) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Server wrapper — calls Clerk.
// ---------------------------------------------------------------------------

// Plan §4, semantics #5: callers (specifically `/l/[slug]`) should skip this
// entirely when the Linky has no policy attached. The short-circuit is a
// meaningful perf win — no Clerk round-trip for the common "public URL"
// case.

const ANONYMOUS_VIEWER: ViewerContext = {
  anonymous: true,
  orgIds: [],
  orgSlugs: [],
};

export async function buildViewerContext(): Promise<ViewerContext> {
  // Bail before touching Clerk if we can see from the session that there's
  // no signed-in user. Faster than a full `currentUser()` fetch.
  const session = await auth();
  if (!session.userId) return ANONYMOUS_VIEWER;

  const user = await currentUser();
  if (!user) return ANONYMOUS_VIEWER;

  // Pull the full membership list. Clerk returns memberships paginated —
  // at the organization scale Linky users live in (tens, not thousands),
  // one page is enough. Bump later if entitlements allow > 100 orgs.
  let memberships: ClerkMembershipLike[] = [];
  try {
    const client = await clerkClient();
    const result = await client.users.getOrganizationMembershipList({
      userId: user.id,
      limit: 100,
    });
    memberships = result.data;
  } catch {
    // Clerk Backend API blips should never hard-fail the resolver. A
    // viewer with zero memberships just won't match org rules — the
    // public fallback covers them.
    memberships = [];
  }

  return mapClerkToViewerContext(
    {
      id: user.id,
      primaryEmailAddressId: user.primaryEmailAddressId,
      emailAddresses: user.emailAddresses.map((entry) => ({
        id: entry.id,
        emailAddress: entry.emailAddress,
      })),
      externalAccounts: user.externalAccounts.map((entry) => ({
        provider: entry.provider,
        emailAddress: entry.emailAddress,
        username: entry.username,
      })),
    },
    memberships,
  );
}
