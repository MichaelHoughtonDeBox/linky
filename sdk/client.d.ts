// Type definitions for the Linky external SDK (`getalinky/sdk`).
//
// Kept structural — the authoritative shapes live in
// `src/lib/linky/types.ts`, `src/lib/server/services/*`, and the service
// DTOs they produce. Any server-side widening of a DTO should widen these
// mirrors in the same PR (see AGENTS.md / the sprint plan §"SDK contract").

export type UrlMetadata = {
  note?: string;
  tags?: string[];
  openPolicy?: "always" | "desktop" | "mobile";
};

// ---------------------------------------------------------------------------
// Resolution policy DSL (Sprint 2). Mirrors `src/lib/linky/policy.ts`.
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
  id?: string;
  name?: string;
  when: PolicyCondition;
  tabs: PolicyTab[];
  stopOnMatch?: boolean;
  showBadge?: boolean;
};

export type ResolutionPolicy = {
  version: 1;
  rules: PolicyRule[];
};

// ---------------------------------------------------------------------------
// Subject / owner DTOs.
// ---------------------------------------------------------------------------

export type LinkyOwnerDto =
  | { type: "anonymous" }
  | { type: "user"; userId: string }
  | { type: "org"; orgId: string };

export type SubjectDto =
  | { type: "user"; userId: string }
  | { type: "org"; orgId: string; userId: string | null };

export type LinkySource = "web" | "cli" | "sdk" | "agent" | "unknown";

// ---------------------------------------------------------------------------
// Linky DTOs.
// ---------------------------------------------------------------------------

export type LinkyDto = {
  slug: string;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  owner: LinkyOwnerDto;
  createdAt: string;
  updatedAt: string;
  source: LinkySource;
  metadata: Record<string, unknown> | null;
  resolutionPolicy: ResolutionPolicy;
};

export type LinkyListItemDto = {
  slug: string;
  title: string | null;
  description: string | null;
  urls: string[];
  urlMetadata: UrlMetadata[];
  owner: LinkyOwnerDto;
  createdAt: string;
  updatedAt: string;
  source: LinkySource;
};

export type LinkyVersionDto = {
  versionNumber: number;
  urls: string[];
  urlMetadata: UrlMetadata[];
  title: string | null;
  description: string | null;
  editedByClerkUserId: string | null;
  editedAt: string;
};

export type CreateLinkyResponseDto = {
  slug: string;
  url: string;
  claimUrl?: string;
  claimToken?: string;
  claimExpiresAt?: string;
  warning?: string;
  resolutionPolicy?: ResolutionPolicy;
};

export type UpdateLinkyResponseDto = {
  linky: LinkyDto;
};

export type DeleteLinkyResponseDto = {
  ok: boolean;
};

export type LinkyListResponseDto = {
  linkies: LinkyListItemDto[];
  pagination: { limit: number; offset: number };
  subject: SubjectDto;
};

export type LinkyVersionsResponseDto = {
  versions: LinkyVersionDto[];
};

// ---------------------------------------------------------------------------
// Insights DTOs.
// ---------------------------------------------------------------------------

export type InsightsRange = "7d" | "30d" | "90d";

export type InsightsTotals = {
  views: number;
  uniqueViewerDays: number;
  openAllClicks: number;
  openAllRate: number;
};

export type InsightsByRuleDto = {
  ruleId: string | null;
  views: number;
  openAllClicks: number;
  openAllRate: number;
  ruleName: string;
};

export type InsightsSeriesPoint = {
  day: string;
  views: number;
  openAllClicks: number;
};

export type LauncherInsightsDto = {
  slug: string;
  range: { from: string; to: string };
  totals: InsightsTotals;
  byRule: InsightsByRuleDto[];
  series: InsightsSeriesPoint[];
};

// ---------------------------------------------------------------------------
// API key DTOs.
// ---------------------------------------------------------------------------

export type ApiKeyPermission = "links:read" | "links:write" | "keys:admin";

export type ApiKeyDto = {
  id: number;
  name: string;
  scope: "user" | "org";
  scopes: ApiKeyPermission[];
  keyPrefix: string;
  // Sprint 2.8 Chunk D: per-key hourly rate limit. 0 = unlimited.
  rateLimitPerHour: number;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type KeyListResponseDto = {
  apiKeys: ApiKeyDto[];
  subject: SubjectDto;
};

export type CreatedKeyResponseDto = {
  apiKey: ApiKeyDto;
  rawKey: string;
  warning: string;
};

export type RevokedKeyResponseDto = {
  apiKey: ApiKeyDto;
};

// ---------------------------------------------------------------------------
// Client options + method inputs.
// ---------------------------------------------------------------------------

export type LinkyClientOptions = {
  baseUrl?: string;
  apiKey?: string;
  client?: string;
  fetchImpl?: typeof fetch;
};

export type CreateLinkyInput = {
  urls: string[];
  source?: LinkySource;
  metadata?: Record<string, unknown>;
  email?: string;
  title?: string;
  description?: string;
  urlMetadata?: UrlMetadata[];
  resolutionPolicy?: ResolutionPolicy | null;
};

export type UpdateLinkyInput = {
  urls?: string[];
  urlMetadata?: UrlMetadata[];
  title?: string | null;
  description?: string | null;
  resolutionPolicy?: ResolutionPolicy | null;
};

export type ListLinkiesInput = {
  limit?: number;
  offset?: number;
};

export type GetInsightsInput = {
  range?: InsightsRange;
};

export type CreateKeyInput = {
  name: string;
  scopes?: ApiKeyPermission[];
  // Sprint 2.8 Chunk D: override the default 1000/hour quota. 0 = no
  // limit (reserve for admin/internal use). Upper bound 100000.
  rateLimitPerHour?: number;
};

// ---------------------------------------------------------------------------
// The client itself.
// ---------------------------------------------------------------------------

export class LinkyApiError extends Error {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
  // Present on HTTP 429 responses. Tells the caller how long to wait
  // before retrying. Sourced from the server's `retryAfterSeconds` in
  // the JSON body; falls back to the `Retry-After` header when the
  // body is empty.
  retryAfterSeconds?: number;
  constructor(init: {
    message: string;
    code?: string;
    statusCode?: number;
    details?: Record<string, unknown>;
    retryAfterSeconds?: number;
  });
}

export class LinkyClient {
  baseUrl: string;
  apiKey?: string;
  client?: string;
  constructor(options?: LinkyClientOptions);

  createLinky(input: CreateLinkyInput): Promise<CreateLinkyResponseDto>;
  getLinky(slug: string): Promise<LinkyDto>;
  listLinkies(params?: ListLinkiesInput): Promise<LinkyListResponseDto>;
  updateLinky(slug: string, patch: UpdateLinkyInput): Promise<UpdateLinkyResponseDto>;
  deleteLinky(slug: string): Promise<DeleteLinkyResponseDto>;
  getVersions(slug: string): Promise<LinkyVersionsResponseDto>;
  getInsights(
    slug: string,
    params?: GetInsightsInput,
  ): Promise<LauncherInsightsDto>;

  whoami(): Promise<KeyListResponseDto>;
  listKeys(): Promise<KeyListResponseDto>;
  createKey(input: CreateKeyInput): Promise<CreatedKeyResponseDto>;
  revokeKey(id: number): Promise<RevokedKeyResponseDto>;
}

export const DEFAULT_BASE_URL: string;
