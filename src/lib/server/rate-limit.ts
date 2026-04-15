import "server-only";

import type { RateLimitConfig } from "./config";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
  remaining: number;
};

declare global {
  var __linkyRateLimitBuckets: Map<string, RateLimitBucket> | undefined;
}

const buckets =
  globalThis.__linkyRateLimitBuckets ?? new Map<string, RateLimitBucket>();
globalThis.__linkyRateLimitBuckets = buckets;

function pruneExpiredBuckets(now: number): void {
  // Defensive cleanup keeps memory bounded in long-lived server processes.
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): RateLimitResult {
  const now = Date.now();

  if (buckets.size > 5_000) {
    pruneExpiredBuckets(now);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + config.windowMs,
    });

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(config.maxRequests - 1, 0),
    };
  }

  if (existing.count >= config.maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        Math.ceil((existing.resetAt - now) / 1000),
        1,
      ),
      remaining: 0,
    };
  }

  existing.count += 1;
  buckets.set(key, existing);

  return {
    allowed: true,
    retryAfterSeconds: 0,
    remaining: Math.max(config.maxRequests - existing.count, 0),
  };
}
