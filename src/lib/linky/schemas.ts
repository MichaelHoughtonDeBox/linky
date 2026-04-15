import { LinkyError } from "./errors";
import type { CreateLinkyPayload, LinkyMetadata, LinkySource } from "./types";
import { normalizeUrlList } from "./urls";

const ALLOWED_SOURCES = new Set<LinkySource>([
  "web",
  "cli",
  "sdk",
  "agent",
  "unknown",
]);

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

  return {
    urls: normalizeUrlList(payload.urls),
    source: normalizeSource(payload.source),
    metadata: normalizeMetadata(payload.metadata),
  };
}
