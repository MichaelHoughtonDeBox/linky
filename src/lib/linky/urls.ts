import { LinkyError } from "./errors";

export const MAX_URLS_PER_LINKY = 25;
const MAX_URL_LENGTH = 2048;
const SUPPORTED_PROTOCOLS = new Set(["http:", "https:"]);

function normalizeOneUrl(rawUrl: unknown, index: number): string {
  if (typeof rawUrl !== "string") {
    throw new LinkyError(`URL at index ${index} must be a string.`, {
      code: "INVALID_URLS",
      statusCode: 400,
    });
  }

  const trimmed = rawUrl.trim();
  if (trimmed.length === 0) {
    throw new LinkyError(`URL at index ${index} cannot be empty.`, {
      code: "INVALID_URLS",
      statusCode: 400,
    });
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new LinkyError(
      `URL at index ${index} is longer than ${MAX_URL_LENGTH} characters.`,
      {
        code: "INVALID_URLS",
        statusCode: 400,
      },
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new LinkyError(`URL at index ${index} is invalid.`, {
      code: "INVALID_URLS",
      statusCode: 400,
    });
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol)) {
    throw new LinkyError(
      `URL at index ${index} must use http:// or https:// protocol.`,
      {
        code: "INVALID_URLS",
        statusCode: 400,
      },
    );
  }

  // URL#toString canonicalizes formatting so web/CLI/API comparisons stay stable.
  return parsed.toString();
}

export function normalizeUrlList(rawUrls: unknown): string[] {
  if (!Array.isArray(rawUrls)) {
    throw new LinkyError("`urls` must be an array of URL strings.", {
      code: "INVALID_URLS",
      statusCode: 400,
    });
  }

  if (rawUrls.length === 0) {
    throw new LinkyError("At least one URL is required.", {
      code: "INVALID_URLS",
      statusCode: 400,
    });
  }

  if (rawUrls.length > MAX_URLS_PER_LINKY) {
    throw new LinkyError(
      `Linky supports up to ${MAX_URLS_PER_LINKY} URLs per bundle.`,
      {
        code: "INVALID_URLS",
        statusCode: 400,
      },
    );
  }

  const seen = new Set<string>();
  const normalized: string[] = [];

  rawUrls.forEach((rawUrl, index) => {
    const parsed = normalizeOneUrl(rawUrl, index);

    // De-duplication keeps the payload compact without changing link order.
    if (!seen.has(parsed)) {
      seen.add(parsed);
      normalized.push(parsed);
    }
  });

  return normalized;
}
