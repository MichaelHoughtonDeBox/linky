import { LinkyError } from "./errors";
import { parseResolutionPolicy } from "./policy";
import type {
  CreateLinkyPayload,
  LinkyMetadata,
  LinkySource,
  OpenPolicy,
  PatchLinkyPayload,
  UrlMetadata,
} from "./types";
import { normalizeUrlList } from "./urls";

const ALLOWED_SOURCES = new Set<LinkySource>([
  "web",
  "cli",
  "sdk",
  "agent",
  "unknown",
]);

const ALLOWED_OPEN_POLICIES = new Set<OpenPolicy>([
  "always",
  "desktop",
  "mobile",
]);

// Maximum per-field sizes. Keep conservative — callers can always expand
// these later once we have telemetry.
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 500;
const MAX_NOTE_LENGTH = 500;
const MAX_CLIENT_ATTRIBUTION_LENGTH = 120;
const MAX_TAGS_PER_URL = 10;
const MAX_TAG_LENGTH = 40;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeSource(rawSource: unknown): LinkySource {
  if (typeof rawSource !== "string") {
    return "unknown";
  }

  const normalized = rawSource.trim().toLowerCase() as LinkySource;
  return ALLOWED_SOURCES.has(normalized) ? normalized : "unknown";
}

function normalizeMetadata(rawMetadata: unknown): LinkyMetadata | undefined {
  if (rawMetadata === undefined || rawMetadata === null) {
    return undefined;
  }

  if (!isRecord(rawMetadata)) {
    throw new LinkyError("`metadata` must be a JSON object when provided.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  return rawMetadata;
}

function normalizeNullableString(
  value: unknown,
  fieldName: string,
  maxLength: number,
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value !== "string") {
    throw new LinkyError(`\`${fieldName}\` must be a string or null.`, {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) return null;

  if (trimmed.length > maxLength) {
    throw new LinkyError(
      `\`${fieldName}\` must be ${maxLength} characters or fewer.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  return trimmed;
}

function normalizeOpenPolicy(value: unknown): OpenPolicy | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value !== "string") {
    throw new LinkyError("`openPolicy` must be a string when provided.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const normalized = value.trim().toLowerCase() as OpenPolicy;
  if (!ALLOWED_OPEN_POLICIES.has(normalized)) {
    throw new LinkyError(
      "`openPolicy` must be one of: always, desktop, mobile.",
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  return normalized;
}

function normalizeTags(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;

  if (!Array.isArray(value)) {
    throw new LinkyError("`tags` must be an array of strings when provided.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  if (value.length > MAX_TAGS_PER_URL) {
    throw new LinkyError(
      `Too many tags; maximum ${MAX_TAGS_PER_URL} per URL.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  const cleaned: string[] = [];
  for (const raw of value) {
    if (typeof raw !== "string") {
      throw new LinkyError("Every tag must be a string.", {
        code: "BAD_REQUEST",
        statusCode: 400,
      });
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (trimmed.length > MAX_TAG_LENGTH) {
      throw new LinkyError(
        `Tag too long (max ${MAX_TAG_LENGTH} chars): ${trimmed.slice(0, 20)}...`,
        { code: "BAD_REQUEST", statusCode: 400 },
      );
    }
    cleaned.push(trimmed);
  }
  return cleaned;
}

function normalizeSingleUrlMetadata(raw: unknown): UrlMetadata {
  if (raw === undefined || raw === null) return {};

  if (!isRecord(raw)) {
    throw new LinkyError(
      "Each `urlMetadata` entry must be a JSON object.",
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  const entry: UrlMetadata = {};

  if (raw.note !== undefined && raw.note !== null) {
    if (typeof raw.note !== "string") {
      throw new LinkyError("`urlMetadata[].note` must be a string.", {
        code: "BAD_REQUEST",
        statusCode: 400,
      });
    }
    const note = raw.note.trim();
    if (note.length > MAX_NOTE_LENGTH) {
      throw new LinkyError(
        `\`urlMetadata[].note\` must be ${MAX_NOTE_LENGTH} characters or fewer.`,
        { code: "BAD_REQUEST", statusCode: 400 },
      );
    }
    if (note) entry.note = note;
  }

  const tags = normalizeTags(raw.tags);
  if (tags && tags.length) entry.tags = tags;

  const openPolicy = normalizeOpenPolicy(raw.openPolicy);
  if (openPolicy) entry.openPolicy = openPolicy;

  return entry;
}

function normalizeUrlMetadataArray(
  raw: unknown,
  expectedLength: number,
  fieldName = "urlMetadata",
): UrlMetadata[] {
  if (raw === undefined || raw === null) {
    return Array.from({ length: expectedLength }, () => ({}));
  }

  if (!Array.isArray(raw)) {
    throw new LinkyError(`\`${fieldName}\` must be an array when provided.`, {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  if (raw.length > expectedLength) {
    throw new LinkyError(
      `\`${fieldName}\` has more entries (${raw.length}) than URLs (${expectedLength}).`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  const result: UrlMetadata[] = [];
  for (let index = 0; index < expectedLength; index += 1) {
    result.push(normalizeSingleUrlMetadata(raw[index]));
  }
  return result;
}

export function parseCreateLinkyPayload(payload: unknown): CreateLinkyPayload {
  if (!isRecord(payload)) {
    throw new LinkyError("Request body must be a JSON object.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  if (typeof payload.alias === "string" && payload.alias.trim().length > 0) {
    throw new LinkyError(
      "Custom aliases are temporarily disabled. Linky currently auto-generates slugs.",
      {
        code: "BAD_REQUEST",
        statusCode: 400,
      },
    );
  }

  const urls = normalizeUrlList(payload.urls);

  const title = normalizeNullableString(payload.title, "title", MAX_TITLE_LENGTH);
  const description = normalizeNullableString(
    payload.description,
    "description",
    MAX_DESCRIPTION_LENGTH,
  );
  const urlMetadata = normalizeUrlMetadataArray(payload.urlMetadata, urls.length);
  const email = normalizeEmail(payload.email);

  return {
    urls,
    source: normalizeSource(payload.source),
    metadata: normalizeMetadata(payload.metadata),
    title: title ?? undefined,
    description: description ?? undefined,
    urlMetadata,
    email,
  };
}

// ---------------------------------------------------------------------------
// Email.
// Used only for the claim flow — validation here is intentionally permissive
// (must contain an @ and a dot, length-capped). Clerk re-validates on sign-up.
// ---------------------------------------------------------------------------

const MAX_EMAIL_LENGTH = 254; // RFC 5321 practical limit.

function normalizeEmail(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;

  if (typeof value !== "string") {
    throw new LinkyError("`email` must be a string when provided.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) return undefined;

  if (trimmed.length > MAX_EMAIL_LENGTH) {
    throw new LinkyError(
      `\`email\` must be ${MAX_EMAIL_LENGTH} characters or fewer.`,
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  // Loose shape check — we are NOT validating deliverability, just catching
  // obvious garbage. Real validation happens when Clerk sends the verify
  // email at sign-up time.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    throw new LinkyError("`email` does not look like a valid address.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  return trimmed;
}

// ---------------------------------------------------------------------------
// PATCH payload.
//
// At least one field must be present; all fields are optional individually.
// When `urls` is provided, `urlMetadata` (if also provided) must match its
// length. When only `urlMetadata` is provided, length is not validated here
// — the repository layer validates against the current URL count.
// ---------------------------------------------------------------------------

export function parsePatchLinkyPayload(payload: unknown): PatchLinkyPayload {
  if (!isRecord(payload)) {
    throw new LinkyError("Request body must be a JSON object.", {
      code: "BAD_REQUEST",
      statusCode: 400,
    });
  }

  const result: PatchLinkyPayload = {};

  if (payload.urls !== undefined) {
    result.urls = normalizeUrlList(payload.urls);
  }

  if (payload.urlMetadata !== undefined) {
    const expectedLength =
      result.urls !== undefined
        ? result.urls.length
        : Array.isArray(payload.urlMetadata)
          ? (payload.urlMetadata as unknown[]).length
          : 0;
    result.urlMetadata = normalizeUrlMetadataArray(
      payload.urlMetadata,
      expectedLength,
    );
  }

  if (payload.title !== undefined) {
    result.title = normalizeNullableString(
      payload.title,
      "title",
      MAX_TITLE_LENGTH,
    ) as string | null;
  }

  if (payload.description !== undefined) {
    result.description = normalizeNullableString(
      payload.description,
      "description",
      MAX_DESCRIPTION_LENGTH,
    ) as string | null;
  }

  if (payload.resolutionPolicy !== undefined) {
    // `null` explicitly clears the policy; `{}` (or `{ rules: [] }`) is
    // equivalent and collapses to the canonical empty form. Anything else
    // must round-trip through `parseResolutionPolicy`, which handles depth,
    // op/field compatibility, size limits, and rule-id minting.
    if (payload.resolutionPolicy === null) {
      result.resolutionPolicy = null;
    } else {
      result.resolutionPolicy = parseResolutionPolicy(payload.resolutionPolicy);
    }
  }

  const hasUpdate =
    result.urls !== undefined ||
    result.urlMetadata !== undefined ||
    result.title !== undefined ||
    result.description !== undefined ||
    result.resolutionPolicy !== undefined;

  if (!hasUpdate) {
    throw new LinkyError(
      "Provide at least one of: urls, urlMetadata, title, description, resolutionPolicy.",
      { code: "BAD_REQUEST", statusCode: 400 },
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Client attribution header (`Linky-Client: <agent>/<tool-version>`).
//
// Optional string that agents/SDKs can send so we can attribute API calls
// to a specific integration. Useful for ops debugging ("our Cursor skill
// is generating 4xx spikes") without leaking real identity. We are
// intentionally permissive: malformed headers are silently dropped rather
// than rejecting the whole request, since a bad client header should never
// break agent workflows.
//
// Valid characters cover the shapes seen in the wild:
//   - cursor/skill-v1
//   - claude-desktop
//   - my-ci-bot.deploys
//   - chatgpt/plugin-linky
// ---------------------------------------------------------------------------

// ASCII letters, digits, and common separator punctuation. No spaces, no
// quotes, no whitespace — keeps the field log-safe and URL-safe.
const CLIENT_ATTRIBUTION_PATTERN = /^[A-Za-z0-9._\-/@+:]+$/;

export function parseClientAttributionHeader(
  raw: string | null | undefined,
): string | undefined {
  if (typeof raw !== "string") return undefined;

  const trimmed = raw.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > MAX_CLIENT_ATTRIBUTION_LENGTH) return undefined;
  if (!CLIENT_ATTRIBUTION_PATTERN.test(trimmed)) return undefined;

  return trimmed;
}
