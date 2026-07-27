import { prisma } from "@/lib/prisma";

/**
 * Postgres-backed fixed-window rate limiting.
 *
 * Redis would be the textbook answer, but this app already depends on Postgres and only
 * throttles a handful of low-traffic endpoints (login, verification submission, password
 * reset). Adding a second datastore for that would be unjustified operational surface.
 * Revisit if throughput ever makes the write volume matter.
 */

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  retryAfterSeconds: number;
};

type ConsumeOptions = {
  /** Stable identity for the limit, e.g. `verification:submit:<userId>`. */
  bucket: string;
  limit: number;
  windowMs: number;
};

export async function consumeRateLimit({
  bucket,
  limit,
  windowMs,
}: ConsumeOptions): Promise<RateLimitResult> {
  const windowStart = new Date(Date.now() - windowMs);

  // Prune first so the count below only sees the live window and the table stays small.
  await prisma.rateLimitHit.deleteMany({
    where: { bucket, createdAt: { lt: windowStart } },
  });

  const used = await prisma.rateLimitHit.count({
    where: { bucket, createdAt: { gte: windowStart } },
  });

  if (used >= limit) {
    const oldest = await prisma.rateLimitHit.findFirst({
      where: { bucket, createdAt: { gte: windowStart } },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    });

    const resetAt = (oldest?.createdAt.getTime() ?? Date.now()) + windowMs;
    return {
      ok: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
    };
  }

  await prisma.rateLimitHit.create({ data: { bucket } });

  return { ok: true, remaining: limit - used - 1, retryAfterSeconds: 0 };
}

export const RATE_LIMITS = {
  /** Three verification submissions per day stops queue flooding without blocking honest retries. */
  verificationSubmit: { limit: 3, windowMs: 24 * 60 * 60 * 1000 },
  login: { limit: 10, windowMs: 15 * 60 * 1000 },
  passwordReset: { limit: 5, windowMs: 60 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Free-text directory searches; facet-only browsing is unlimited. */
  search: { limit: 60, windowMs: 15 * 60 * 1000 },
} as const;

export function formatRetryAfter(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}
