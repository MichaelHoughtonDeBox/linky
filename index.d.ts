export type UrlMetadata = {
  note?: string;
  tags?: string[];
  openPolicy?: "always" | "desktop" | "mobile";
};

// ---------------------------------------------------------------------------
// Resolution policy DSL (Sprint 2). Kept structural here so the SDK has
// zero runtime dependencies on the repo's internal types module. The
// authoritative shape lives in `src/lib/linky/policy.ts`; any server-side
// change that widens the DSL should widen these mirrors in the same PR.
// ---------------------------------------------------------------------------

export type PolicyViewerField =
  | "email"
  | "emailDomain"
  | "userId"
  | "githubLogin"
  | "googleEmail"
  | "orgIds"
  | "orgSlugs";

export type PolicyCondition =
  | { op: "always" }
  | { op: "anonymous" }
  | { op: "signedIn" }
  | { op: "equals"; field: PolicyViewerField; value: string }
  | { op: "in"; field: PolicyViewerField; value: string[] }
  | { op: "endsWith"; field: PolicyViewerField; value: string }
  | { op: "exists"; field: PolicyViewerField }
  | { op: "and"; of: PolicyCondition[] }
  | { op: "or"; of: PolicyCondition[] }
  | { op: "not"; of: [PolicyCondition] };

export type PolicyTab = {
  url: string;
  note?: string;
};

export type PolicyRule = {
  // Optional on the wire — the server mints a ULID-style id when absent.
  id?: string;
  name?: string;
  when: PolicyCondition;
  tabs: PolicyTab[];
  // Both default server-side when omitted (stopOnMatch: true, showBadge: false).
  stopOnMatch?: boolean;
  showBadge?: boolean;
};

export type ResolutionPolicy = {
  version: 1;
  rules: PolicyRule[];
};

export type CreateLinkyOptions = {
  urls: string[];
  baseUrl?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  // When provided, the API mints a claim token flagged with this email so
  // the named recipient can later take ownership by signing in through the
  // returned `claimUrl`. Applies only to anonymous (unauthenticated) calls.
  email?: string;
  title?: string;
  description?: string;
  urlMetadata?: UrlMetadata[];
  // Optional `Linky-Client` header value for ops attribution. Convention:
  // `<tool>/<version>` (e.g. "cursor/skill-v1"). Malformed values are
  // silently dropped server-side and do NOT break the create call.
  client?: string;
  // Sprint 2.5: attach an identity-aware resolution policy at create time.
  // When present, the new Linky is born personalized — `/l/<slug>` will
  // evaluate this policy against every viewer. Caveat: anonymous Linkies
  // are immutable, so an agent-created anonymous Linky with a policy stays
  // locked to that policy until it's claimed.
  resolutionPolicy?: ResolutionPolicy;
  fetchImpl?: typeof fetch;
};

export type CreateLinkyResult = {
  slug: string;
  url: string;
  // The three `claim*` fields are only returned when the Linky was created
  // anonymously. Visiting `claimUrl` (or hitting a claim endpoint with
  // `claimToken`) prompts the visitor to sign in and transfers ownership to
  // their Clerk user / active org.
  //
  // IMPORTANT: `claimToken` is returned ONCE and cannot be recovered. Persist
  // it (or `claimUrl`, which embeds it) somewhere durable before the call
  // returns. Surface `warning` verbatim to the end user when you can.
  claimUrl?: string;
  claimToken?: string;
  claimExpiresAt?: string;
  warning?: string;
  // Sprint 2.5: present when a policy was attached at create time. The
  // server echoes the parsed form (with minted rule ids) so the caller
  // doesn't need a second fetch to know the canonical rule shape.
  resolutionPolicy?: ResolutionPolicy;
};

export type UpdateLinkyOptions = {
  slug: string;
  baseUrl?: string;
  title?: string | null;
  description?: string | null;
  urls?: string[];
  urlMetadata?: UrlMetadata[];
  resolutionPolicy?: ResolutionPolicy | null;
  client?: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
};

export type UpdateLinkyResult = {
  slug: string;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  updatedAt?: string;
  resolutionPolicy?: ResolutionPolicy;
};

export const DEFAULT_BASE_URL: string;

export function createLinky(
  options: CreateLinkyOptions,
): Promise<CreateLinkyResult>;

export function updateLinky(
  options: UpdateLinkyOptions,
): Promise<UpdateLinkyResult>;

// Sprint 2.8 Chunk 0: the full LinkyClient surface is re-exported here so
// consumers importing from the default entry get the widened API
// (`import { LinkyClient } from "getalinky"`) without switching
// subpaths. Subpath import (`getalinky/sdk`) is the recommended form
// for new code — see README.
export { LinkyClient, LinkyApiError } from "./sdk/client";
