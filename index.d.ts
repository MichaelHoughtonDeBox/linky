export type UrlMetadata = {
  note?: string;
  tags?: string[];
  openPolicy?: "always" | "desktop" | "mobile";
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
};

export const DEFAULT_BASE_URL: string;

export function createLinky(
  options: CreateLinkyOptions,
): Promise<CreateLinkyResult>;
