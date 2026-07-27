/**
 * Process-local fixed-window rate limiter for hot paths where a Postgres round-trip
 * (~1s+ to a remote pooler) would dominate latency.
 *
 * Not shared across serverless isolates — that is acceptable for directory search
 * scrape throttling. Login / register / verification still use the Postgres limiter.
 */

type WindowState = {
  count: number;
  windowStart: number;
};

const buckets = new Map<string, WindowState>();

export type MemoryRateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

export function consumeMemoryRateLimit(options: {
  bucket: string;
  limit: number;
  windowMs: number;
}): MemoryRateLimitResult {
  const now = Date.now();
  const existing = buckets.get(options.bucket);

  if (!existing || now - existing.windowStart >= options.windowMs) {
    buckets.set(options.bucket, { count: 1, windowStart: now });
    return {
      ok: true,
      remaining: options.limit - 1,
      retryAfterSeconds: 0,
    };
  }

  if (existing.count >= options.limit) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((existing.windowStart + options.windowMs - now) / 1000),
    );
    return { ok: false, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return {
    ok: true,
    remaining: options.limit - existing.count,
    retryAfterSeconds: 0,
  };
}
