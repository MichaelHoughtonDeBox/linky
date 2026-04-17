export type LinkySource = "web" | "cli" | "sdk" | "agent" | "unknown";

export type LinkyMetadata = Record<string, unknown>;

// ---------------------------------------------------------------------------
// Per-URL metadata.
//
// Stored positionally in the `url_metadata` JSONB column on linkies — index
// N in `url_metadata` corresponds to index N in `urls`. Missing / trailing
// entries default to an empty object.
//
// `openPolicy` is a hint consumed by the launcher when deciding whether to
// open a URL on a given device. Full policy evaluation lands in Sprint 2
// (URL-as-API); Sprint 1 stores the field but the launcher ignores it.
// ---------------------------------------------------------------------------

export type OpenPolicy = "always" | "desktop" | "mobile";

export type UrlMetadata = {
  note?: string;
  tags?: string[];
  openPolicy?: OpenPolicy;
};

export type CreateLinkyPayload = {
  urls: string[];
  source: LinkySource;
  metadata?: LinkyMetadata;
  // New in Sprint 1: optional headline + blurb + per-URL metadata, surfaced
  // in the launcher UI and the dashboard.
  title?: string;
  description?: string;
  urlMetadata?: UrlMetadata[];
  // Optional: when provided on an anonymous create, we mint a claim token
  // tied to this email so the recipient can bind the Linky to their account
  // by clicking the returned claim URL (and, in a future iteration, we may
  // email it directly). Presence alone does NOT authenticate the request;
  // the Linky stays anonymous until the token is consumed via sign-in.
  email?: string;
  // Sprint 2.5: optional resolution policy attached at create time. When
  // present, the new Linky is born personalized — `/l/[slug]` will evaluate
  // this policy against every viewer instead of serving `urls` as a static
  // list. Absent / `undefined` keeps the empty-policy default (public for
  // everyone). Note: anonymous creates with a policy still work; the policy
  // will stay locked until the Linky is claimed, because anonymous Linkies
  // are immutable — plan accordingly.
  resolutionPolicy?: ResolutionPolicy;
};

export type CreateLinkyResponse = {
  slug: string;
  url: string;
  // Present when the Linky was created anonymously. Clicking the URL
  // prompts the visitor to sign in, then transfers ownership to their
  // Clerk user / active org.
  claimUrl?: string;
  claimExpiresAt?: string;
  // The raw token by itself — useful for agents that want to persist the
  // secret independently of the full URL (for re-assembly against a
  // different base URL, or storage in a secret manager). ONLY returned
  // ONCE at creation time; a lost token cannot be recovered, the anonymous
  // Linky must be re-created. This matches the ergonomics agents expect
  // after working with other agent-first publishing products.
  claimToken?: string;
  // Human-readable warning string that agents/CLIs can surface verbatim.
  // Present only when `claimToken` is present.
  warning?: string;
  // Sprint 2.5: present when the caller attached a resolution policy at
  // create time. Echoed back so agents/CLIs can confirm the parsed form
  // (server-minted rule ids in particular) without a second fetch.
  resolutionPolicy?: ResolutionPolicy;
};

export type LinkyOwner =
  | { type: "anonymous" }
  | { type: "user"; userId: string }
  | { type: "org"; orgId: string };

import type { ResolutionPolicy } from "./policy";

export type LinkyRecord = {
  id: number;
  slug: string;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  owner: LinkyOwner;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  source: LinkySource;
  metadata: LinkyMetadata | null;
  // Sprint 2: identity-aware resolution policy (rules engine). Empty
  // policies (`{ version: 1, rules: [] }`) are valid and mean "serve
  // `urls` as-is to every viewer". See `src/lib/linky/policy.ts`.
  resolutionPolicy: ResolutionPolicy;
};

// ---------------------------------------------------------------------------
// Patch payload.
//
// All fields are optional; only provided fields are updated. Passing
// `urls` requires `urlMetadata` to have the same length (or be omitted,
// in which case it's padded with empty objects on the server).
// ---------------------------------------------------------------------------

export type PatchLinkyPayload = {
  urls?: string[];
  urlMetadata?: UrlMetadata[];
  title?: string | null;
  description?: string | null;
  // Sprint 2: null clears any existing policy; a parsed policy replaces it
  // wholesale. Absence means "leave the current policy untouched".
  resolutionPolicy?: ResolutionPolicy | null;
};

export type LinkyVersionRecord = {
  versionNumber: number;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  resolutionPolicy: ResolutionPolicy;
  editedByClerkUserId: string | null;
  editedAt: string;
};
