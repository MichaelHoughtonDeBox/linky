import "server-only";

import { auth } from "@clerk/nextjs/server";

import {
  authenticateApiKey,
  expandScopes,
  type ApiKeyPermission,
} from "./api-keys";

// ---------------------------------------------------------------------------
// Authenticated subject model.
//
// Linky rows can be owned by three kinds of subjects:
//   - "org"       — a Clerk organization (team plan)
//   - "user"      — a Clerk user (solo plan)
//   - "anonymous" — no signed-in identity (today's default, preserved forever)
//
// Ownership resolution rules (for CREATE):
//   1. If the request has active org context → org-owned.
//   2. Else if the request has a signed-in user → user-owned.
//   3. Otherwise → anonymous (immutable).
//
// Ownership enforcement (for UPDATE/DELETE) lives in the repository layer,
// which compares the subject against the stored owner columns.
// ---------------------------------------------------------------------------

export type OrgSubject = {
  type: "org";
  orgId: string;
  // Clerk-backed org context carries the active human user id. Org-scoped API
  // keys deliberately do NOT: they authenticate as the org only, so they
  // cannot accidentally bleed into user-owned resources.
  userId: string | null;
  // Raw Clerk role slug. `session.orgRole` is populated by Clerk for browser
  // sessions; API-key subjects leave this `null`. Always funnel through
  // `deriveMembershipRole` before making an access decision so the mapping
  // lives in one place.
  role: string | null;
  // Sprint 2.7 Chunk D: scope claims attached to the authenticating API key.
  // `undefined` means "session subject — no scope limit applies" (signed-in
  // humans are not limited by the key model). A present array is the
  // stored scope list (post-normalization); use `subjectHasScope` to ask
  // implication-aware questions.
  scopes?: ApiKeyPermission[];
};

export type UserSubject = {
  type: "user";
  userId: string;
  scopes?: ApiKeyPermission[];
};

export type AnonymousSubject = {
  type: "anonymous";
};

export type AuthenticatedSubject = OrgSubject | UserSubject;
export type AuthSubject = AuthenticatedSubject | AnonymousSubject;

function parseBearerToken(request: Request): string | null {
  const raw = request.headers.get("authorization");
  if (!raw) return null;

  const match = /^\s*Bearer\s+(.+?)\s*$/i.exec(raw);
  if (!match) return null;

  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

async function getSessionAuthSubject(): Promise<AuthSubject> {
  const session = await auth();

  if (!session.userId) {
    return { type: "anonymous" };
  }

  if (session.orgId) {
    return {
      type: "org",
      orgId: session.orgId,
      userId: session.userId,
      // Clerk's session exposes the active org role when org context is
      // selected. `orgRole` is a role slug like "org:admin" or a custom role
      // configured in the Clerk dashboard.
      role: session.orgRole ?? null,
    };
  }

  return {
    type: "user",
    userId: session.userId,
  };
}

async function getRequestAuthSubject(request: Request): Promise<AuthSubject> {
  const bearerToken = parseBearerToken(request);
  if (bearerToken) {
    const apiKeySubject = await authenticateApiKey(bearerToken);
    if (!apiKeySubject) {
      throw new AuthRequiredError("Invalid API key.");
    }
    return apiKeySubject;
  }

  return getSessionAuthSubject();
}

/**
 * Resolve the active subject for the current request.
 *
 * Safe to call from any server context (Server Components, Route Handlers,
 * Server Actions). Returns an anonymous subject if no Clerk session is
 * present — callers that require auth should guard explicitly.
 */
export async function getAuthSubject(request?: Request): Promise<AuthSubject> {
  if (request) {
    return getRequestAuthSubject(request);
  }

  return getSessionAuthSubject();
}

/**
 * Resolve the subject or throw if unauthenticated. Convenience for routes
 * that must have a signed-in user. Callers still need to check ownership.
 */
export async function requireAuthSubject(
  request?: Request,
): Promise<AuthenticatedSubject> {
  const subject = await getAuthSubject(request);

  if (subject.type === "anonymous") {
    throw new AuthRequiredError();
  }

  return subject;
}

/**
 * Resolve the signed-in Clerk user id from the browser session only.
 *
 * Claim consumption is intentionally human-mediated: API keys may edit owned
 * Linkies, but they must never claim anonymous ones. This helper preserves
 * that boundary without forcing callers to reason about bearer-auth subjects.
 */
export async function requireSessionUserId(): Promise<string> {
  const session = await auth();
  if (!session.userId) {
    throw new AuthRequiredError();
  }
  return session.userId;
}

export class AuthRequiredError extends Error {
  readonly code = "UNAUTHORIZED";
  readonly statusCode = 401;

  constructor(message = "Authentication required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  readonly statusCode = 403;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

// ---------------------------------------------------------------------------
// Ownership check.
// ---------------------------------------------------------------------------

export type LinkyOwnership = {
  ownerUserId: string | null;
  ownerOrgId: string | null;
};

// ---------------------------------------------------------------------------
// Derived membership roles (Sprint 2.7 Chunk C).
//
// We read `memberships.role` from Clerk (populated by webhooks since
// Sprint 1, read nowhere until now) and collapse it into a three-level
// model that maps to our gate surface:
//
//   admin  — can view, edit, delete, and manage API keys.
//   editor — can view + edit. Cannot delete. Cannot manage keys.
//   viewer — can view only. Cannot edit, delete, or manage keys.
//
// Mapping rules (conservative on unknown roles — we'd rather deny an
// undocumented role than silently grant it):
//
//   Clerk slug "org:admin"             → admin
//   Clerk slug "org:member"            → editor (today's default posture)
//   Custom slug starts with            → editor
//     "linky:editor" (any suffix)
//   Anything else (unknown / custom)   → viewer
//
// This intentionally does NOT let a custom Clerk role escalate to `admin`
// — privilege escalation has to go through Clerk's native admin slug.
// If an org needs a "power user who is not a Clerk admin," the supported
// path is naming a role with the `linky:editor:*` prefix (e.g.
// `linky:editor:reviews`).
//
// API-key org subjects carry `role: null` on purpose (see `AuthSubject`)
// — their effective role is computed at gate time by the caller from
// scope claims (Chunk D). For pure RBAC checks without scope info, a
// null role is treated as `editor` (matches today's behavior where every
// org API key has full edit rights — we don't want Chunk C to be a
// tightening for that surface).
// ---------------------------------------------------------------------------

export type MembershipRole = "admin" | "editor" | "viewer";

/**
 * Extract the derived role from an `AuthSubject` without touching the DB.
 *
 * - User subjects are always `admin` of their own resources — there is no
 *   RBAC inside a personal subject.
 * - Org subjects derived from a Clerk browser session carry `session.orgRole`
 *   verbatim; we run it through `deriveMembershipRole`.
 * - Org-scoped API keys carry `role: null` (no Clerk session). We return
 *   `editor` as a safe default that matches today's behavior — if the
 *   caller wants stricter enforcement (e.g. "this API key should not be
 *   able to delete"), that belongs to Chunk D's scope model, not this role.
 * - Anonymous subjects: returning `viewer` is conservative and keeps the
 *   caller's switch total. The ownership check always fails first anyway.
 */
export function roleOfSubject(subject: AuthSubject): MembershipRole {
  if (subject.type === "user") return "admin";
  if (subject.type === "anonymous") return "viewer";
  return deriveMembershipRole(subject.role);
}

// ---------------------------------------------------------------------------
// Scope check (Sprint 2.7 Chunk D).
//
// Session subjects (browser Clerk auth) ignore scope — a signed-in human is
// not scope-limited by the key model. Only bearer-auth subjects carry
// `scopes`, and `subjectHasScope` respects the implication rules from
// `api-keys.ts` (write -> read, admin -> write + read).
//
// Call sites pair this with the existing role check: the scope is a cap
// on the API KEY's authority, the role is a cap on the ACTING IDENTITY's
// authority. Both must pass.
// ---------------------------------------------------------------------------

export function subjectHasScope(
  subject: AuthSubject,
  required: ApiKeyPermission,
): boolean {
  if (subject.type === "anonymous") return false;
  if (!subject.scopes) {
    // No scopes attached → session subject → full authority. User subjects
    // and Clerk-session org subjects fall through this path.
    return true;
  }
  return expandScopes(subject.scopes).has(required);
}

export function requireScope(
  subject: AuthSubject,
  required: ApiKeyPermission,
): void {
  if (!subjectHasScope(subject, required)) {
    throw new ForbiddenError(
      `This API key does not carry the '${required}' scope. Mint a new key with '${required}' or use a key of higher authority.`,
    );
  }
}

export function deriveMembershipRole(
  rawRole: string | null | undefined,
): MembershipRole {
  if (!rawRole) return "editor";

  // Normalize whitespace but preserve case — Clerk slugs are lowercase by
  // convention, but we don't want to mishandle a hypothetical "Org:Admin"
  // that came through an export/import round-trip.
  const slug = rawRole.trim().toLowerCase();

  if (slug === "org:admin") return "admin";
  if (slug === "org:member") return "editor";
  if (slug.startsWith("linky:editor")) return "editor";

  return "viewer";
}

// ---------------------------------------------------------------------------
// Membership + ownership primitives.
//
// `subjectMembership(subject, ownership)` asks a simpler question than
// "can this subject edit?": is the subject a member of the owning subject?
// Three results:
//
//   "owner"       — the subject IS the owner (user-owned case) or is a
//                   member of the owning org (org-owned case). Role check
//                   determines what they can do.
//   "user-in-org" — the subject is a signed-in user who is ambient-member
//                   of the owning org but has NOT selected that org as
//                   their active Clerk context. We deny edits here by
//                   design — org writes require active org context — but
//                   we can relax view in the future if the product wants
//                   that (it does not today; signed-in non-owners fall
//                   through to the public fallback).
//   "stranger"    — no relationship. Always denied.
//
// We fold this logic into the three `canX` helpers below rather than
// exporting `subjectMembership` directly — callers should reason in terms
// of actions, not memberships.
// ---------------------------------------------------------------------------

function isSubjectOwnerOfLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
): boolean {
  const isAnonymousLinky =
    !ownership.ownerUserId && !ownership.ownerOrgId;
  if (isAnonymousLinky) return false;

  if (subject.type === "anonymous") return false;

  if (ownership.ownerOrgId) {
    return subject.type === "org" && subject.orgId === ownership.ownerOrgId;
  }

  if (ownership.ownerUserId) {
    return (
      (subject.type === "user" && subject.userId === ownership.ownerUserId) ||
      (subject.type === "org" &&
        subject.userId !== null &&
        subject.userId === ownership.ownerUserId)
    );
  }

  return false;
}

function effectiveRole(
  subject: AuthSubject,
  role: MembershipRole | null | undefined,
): MembershipRole {
  if (role) return role;

  // User-owned access falls through this path: the owner is always "admin"
  // of their own resources. (There is no RBAC inside a personal subject.)
  if (subject.type === "user") return "admin";

  // Org subjects without an explicit role derived from the Clerk session
  // are treated as `editor`. This preserves today's behavior where org
  // API keys and any org member could edit. `admin` is only granted when
  // the caller explicitly passes a role derived via `deriveMembershipRole`
  // from the Clerk session.
  return "editor";
}

/**
 * Returns true iff the subject can VIEW an owned Linky's private surfaces
 * (insights, version history, owner DTO with policy).
 *
 * Every role can view. This exists as a distinct primitive so future
 * read-only audiences (e.g. "compliance readers") can gate here without
 * opening the edit path.
 *
 * Anonymous Linkies are not viewable through private surfaces — their
 * only surface is the public launcher at `/l/:slug`.
 */
export function canViewLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): boolean {
  if (!isSubjectOwnerOfLinky(subject, ownership)) return false;
  // All three derived roles (viewer / editor / admin) can view. Present
  // as a switch for symmetry with the other primitives and so new roles
  // added later are explicit about their read behavior.
  const resolved = effectiveRole(subject, role);
  return resolved === "viewer" || resolved === "editor" || resolved === "admin";
}

/**
 * Returns true iff the subject can EDIT an owned Linky (PATCH + related
 * write paths that are not destructive).
 *
 * - Anonymous Linkies: never editable (trust model — shipped since
 *   Sprint 1).
 * - User-owned: only the owning user.
 * - Org-owned: `editor` and `admin` derived roles. `viewer` is read-only.
 */
export function canEditLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): boolean {
  if (!isSubjectOwnerOfLinky(subject, ownership)) return false;
  const resolved = effectiveRole(subject, role);
  return resolved === "editor" || resolved === "admin";
}

/**
 * Returns true iff the subject can ADMIN an owned Linky (DELETE, API key
 * management, destructive ops).
 *
 * - Anonymous Linkies: never — they are immutable and no admin surface
 *   exists for them.
 * - User-owned: only the owning user.
 * - Org-owned: only `admin` derived role. `editor` intentionally can NOT
 *   delete — Sprint 2.7 tightens this from the earlier "any org member
 *   can delete" behavior. Documented in the PR body + Access Control doc.
 *
 *   Tradeoff: delete is soft and shows up in version history, so the
 *   escape hatch for a locked-out editor is "ask an admin" or "promote
 *   the role in Clerk." We'd rather require that than let every member
 *   nuke a team-owned bundle unilaterally.
 */
export function canAdminLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): boolean {
  if (!isSubjectOwnerOfLinky(subject, ownership)) return false;
  const resolved = effectiveRole(subject, role);
  return resolved === "admin";
}

/** Throws ForbiddenError if the subject cannot view the Linky. */
export function requireCanViewLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): void {
  if (!canViewLinky(subject, ownership, role)) {
    throw new ForbiddenError();
  }
}

/** Throws ForbiddenError if the subject cannot edit the Linky. */
export function requireCanEditLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): void {
  if (!canEditLinky(subject, ownership, role)) {
    throw new ForbiddenError();
  }
}

/** Throws ForbiddenError if the subject cannot admin the Linky. */
export function requireCanAdminLinky(
  subject: AuthSubject,
  ownership: LinkyOwnership,
  role?: MembershipRole | null,
): void {
  if (!canAdminLinky(subject, ownership, role)) {
    throw new ForbiddenError();
  }
}
