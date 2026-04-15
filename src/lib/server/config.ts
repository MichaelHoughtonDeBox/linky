import "server-only";

import { LinkyError } from "@/lib/linky/errors";

export type RateLimitConfig = {
  windowMs: number;
  maxRequests: number;
};

const DEFAULT_RATE_LIMIT_WINDOW_MS = 60_000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 30;

function parseNumberEnv(
  rawValue: string | undefined,
  fallback: number,
  envName: string,
): number {
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new LinkyError(`${envName} must be a positive number.`, {
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  }

  return parsed;
}

function normalizeBaseUrl(url: string): string {
  try {
    return new URL(url).toString().replace(/\/$/, "");
  } catch {
    throw new LinkyError("LINKY_BASE_URL must be a valid URL.", {
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  }
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    windowMs: parseNumberEnv(
      process.env.LINKY_RATE_LIMIT_WINDOW_MS,
      DEFAULT_RATE_LIMIT_WINDOW_MS,
      "LINKY_RATE_LIMIT_WINDOW_MS",
    ),
    maxRequests: parseNumberEnv(
      process.env.LINKY_RATE_LIMIT_MAX_REQUESTS,
      DEFAULT_RATE_LIMIT_MAX_REQUESTS,
      "LINKY_RATE_LIMIT_MAX_REQUESTS",
    ),
  };
}

export function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new LinkyError("DATABASE_URL is not configured.", {
      code: "INTERNAL_ERROR",
      statusCode: 500,
    });
  }

  return databaseUrl;
}

export function getPublicBaseUrl(requestOrigin?: string): string {
  const configured =
    process.env.LINKY_BASE_URL ?? process.env.NEXT_PUBLIC_LINKY_BASE_URL;

  if (configured) {
    return normalizeBaseUrl(configured);
  }

  if (requestOrigin) {
    return normalizeBaseUrl(requestOrigin);
  }

  return "http://localhost:4040";
}
