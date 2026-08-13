import { NextResponse } from "next/server";
import { serverEnv } from "@/env";
import { expireDueSessions } from "@/lib/auth/session-lifecycle";
import { secretsMatch } from "@/lib/dal/audit";

/**
 * Writes SESSION_EXPIRED for sessions whose 30-day window has closed.
 *
 * Expiry is only enforced here for the audit trail — access control already rejects a session
 * past `expiresAt` on the next request, so a missed run delays the record rather than leaving a
 * usable session open.
 *
 * Vercel retries a failed cron invocation, so the work has to be idempotent: the partial unique
 * index on (sessionId, action) means a re-run cannot duplicate events, and each transition is
 * conditioned on the session still being ACTIVE.
 *
 * Scheduled daily in vercel.json rather than hourly: a Hobby plan rejects any cron expression
 * that would fire more than once a day, and fails the deployment rather than degrading. Since
 * this job only writes the record of an expiry that access control already enforces, daily is
 * the right cadence anyway.
 */

/**
 * Bounded so the function finishes well inside its wall-clock budget, which is 10s on a Hobby
 * plan. The sweep costs three round trips per 50 sessions, so this batch is a couple of seconds
 * against a hosted database; anything left over is reported as `remaining` for the next run.
 */
const BATCH_LIMIT = 500;

export async function GET(request: Request) {
  if (!serverEnv.CRON_SECRET) {
    return NextResponse.json({ error: "Cron is not configured." }, { status: 503 });
  }

  // Vercel Cron sends the secret as a bearer token.
  const header = request.headers.get("authorization") ?? "";
  const provided = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!provided || !secretsMatch(provided, serverEnv.CRON_SECRET)) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const result = await expireDueSessions(BATCH_LIMIT);

  return NextResponse.json(
    {
      expired: result.expired,
      // Non-zero means the backlog exceeded one batch; the next scheduled run picks it up.
      remaining: result.remaining,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
