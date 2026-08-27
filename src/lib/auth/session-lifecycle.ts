import { headers } from "next/headers";
import { AuthSessionStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  AUDIT_REASONS,
  AUTH_AUDIT_ACTIONS,
  AUTH_PROVIDERS,
  type AuditReason,
  type AuthProvider,
} from "@/lib/audit-events";
import { sanitiseIpAddress, sanitiseUserAgent } from "@/lib/audit-redaction";
import { writeAuthAuditLog } from "@/lib/dal/audit";

/**
 * Server-side session lifecycle.
 *
 * Auth.js issues stateless JWTs, so "sign this user out now" cannot be expressed by the cookie
 * alone — it stays cryptographically valid until it expires. Every issued session therefore gets
 * an `AuthSession` row, the DAL checks that row on each request, and revocation is a single UPDATE
 * that takes effect on the next request rather than up to an hour later.
 *
 * State transitions and their audit rows are always written in one transaction: a session that is
 * ended without a trace, or a trace without the session actually ending, are both worse than
 * failing the operation outright.
 */

type PrismaLike = Prisma.TransactionClient | typeof prisma;

/** Mirrors `session.maxAge` in src/auth.config.ts. */
export const SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export type RequestContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

/**
 * Best-effort request fingerprint. Returns nulls outside a request scope (background jobs)
 * rather than throwing, because an audit row without an IP is still worth writing.
 */
export async function getRequestContext(): Promise<RequestContext> {
  try {
    const headerList = await headers();
    return {
      ipAddress:
        headerList.get("x-forwarded-for") ?? headerList.get("x-real-ip") ?? null,
      userAgent: headerList.get("user-agent"),
    };
  } catch {
    return { ipAddress: null, userAgent: null };
  }
}

/**
 * Opens a session and records LOGIN_SUCCESS atomically.
 *
 * Returns the new session id, which the JWT callback stores as a claim so later requests can
 * find this row. The actor snapshot is read here rather than passed in, so the audit row cannot
 * disagree with the row the session was opened against.
 */
export async function startSession(input: {
  userId: string;
  provider: AuthProvider;
  context?: RequestContext;
}): Promise<string> {
  const context = input.context ?? (await getRequestContext());
  const now = Date.now();

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUniqueOrThrow({
      where: { id: input.userId },
      select: { id: true, email: true, role: true },
    });

    const session = await tx.authSession.create({
      data: {
        userId: user.id,
        provider: input.provider,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        expiresAt: new Date(now + SESSION_MAX_AGE_MS),
      },
      select: { id: true },
    });

    await writeAuthAuditLog(tx, {
      action: AUTH_AUDIT_ACTIONS.loginSuccess,
      actorId: user.id,
      actorEmail: user.email,
      actorRole: user.role,
      sessionId: session.id,
      provider: input.provider,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
    });

    return session.id;
  });
}

type EndSessionOutcome = "ended" | "already_ended" | "not_found";

async function endSession(
  client: PrismaLike,
  input: {
    sessionId: string;
    status: Extract<
      AuthSessionStatus,
      "LOGGED_OUT" | "EXPIRED" | "REVOKED"
    >;
    action: (typeof AUTH_AUDIT_ACTIONS)[keyof typeof AUTH_AUDIT_ACTIONS];
    reason?: AuditReason | null;
    provider?: AuthProvider | null;
    context?: RequestContext;
  },
): Promise<EndSessionOutcome> {
  // Conditioned on status = ACTIVE so two concurrent callers cannot both transition the row;
  // the loser sees count 0 and skips its audit write.
  const transitioned = await client.authSession.updateMany({
    where: { id: input.sessionId, status: AuthSessionStatus.ACTIVE },
    data: {
      status: input.status,
      endedAt: new Date(),
      endedReason: input.reason ?? null,
    },
  });

  if (transitioned.count === 0) {
    const exists = await client.authSession.findUnique({
      where: { id: input.sessionId },
      select: { id: true },
    });
    return exists ? "already_ended" : "not_found";
  }

  const session = await client.authSession.findUniqueOrThrow({
    where: { id: input.sessionId },
    select: {
      provider: true,
      ipAddress: true,
      userAgent: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });

  await writeAuthAuditLog(client, {
    action: input.action,
    actorId: session.user.id,
    actorEmail: session.user.email,
    actorRole: session.user.role,
    sessionId: input.sessionId,
    provider: input.provider ?? (session.provider as AuthProvider),
    reason: input.reason ?? null,
    // Prefer the current request's fingerprint; fall back to the one captured at sign-in so a
    // background transition still carries something useful.
    ipAddress: input.context?.ipAddress ?? session.ipAddress,
    userAgent: input.context?.userAgent ?? session.userAgent,
  });

  return "ended";
}

/** Marks a session as ended by the user and records LOGOUT. */
export async function endSessionByLogout(
  sessionId: string,
  context?: RequestContext,
): Promise<EndSessionOutcome> {
  return prisma.$transaction((tx) =>
    endSession(tx, {
      sessionId,
      status: AuthSessionStatus.LOGGED_OUT,
      action: AUTH_AUDIT_ACTIONS.logout,
      context,
    }),
  );
}

/**
 * Revokes every live session for a user and records one SESSION_REVOKED per session.
 *
 * Set-based (like `expireDueSessions`): one UPDATE + one `createMany`, not three round trips
 * per session. Callers nest this inside a short interactive transaction (account close,
 * password reset); a per-row loop against remote Postgres blows the 5s default timeout.
 *
 * Accepts a transaction client so revoke stays atomic with the change that justified it.
 */
export async function revokeUserSessions(
  client: PrismaLike,
  input: {
    userId: string;
    reason: AuditReason;
    /** Leave this session alive, e.g. the administrator performing the action. */
    exceptSessionId?: string | null;
    context?: RequestContext;
  },
): Promise<number> {
  const live = await client.authSession.findMany({
    where: {
      userId: input.userId,
      status: AuthSessionStatus.ACTIVE,
      ...(input.exceptSessionId ? { id: { not: input.exceptSessionId } } : {}),
    },
    select: {
      id: true,
      provider: true,
      ipAddress: true,
      userAgent: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });

  if (live.length === 0) return 0;

  const ids = live.map((session) => session.id);

  const transitioned = await client.$queryRaw<{ id: string }[]>(Prisma.sql`
    UPDATE "AuthSession"
       SET "status"      = ${AuthSessionStatus.REVOKED}::"AuthSessionStatus",
           "endedAt"     = ${new Date()},
           "endedReason" = ${input.reason}
     WHERE "id" IN (${Prisma.join(ids)})
       AND "status" = ${AuthSessionStatus.ACTIVE}::"AuthSessionStatus"
    RETURNING "id"
  `);

  if (transitioned.length === 0) return 0;

  const byId = new Map(live.map((session) => [session.id, session]));

  await client.auditLog.createMany({
    data: transitioned.flatMap(({ id }) => {
      const session = byId.get(id);
      if (!session) return [];
      return [
        {
          action: AUTH_AUDIT_ACTIONS.sessionRevoked,
          actorId: session.user.id,
          actorEmail: session.user.email,
          actorRole: session.user.role,
          sessionId: id,
          provider: session.provider,
          reason: input.reason,
          ipAddress: sanitiseIpAddress(input.context?.ipAddress ?? session.ipAddress),
          userAgent: sanitiseUserAgent(input.context?.userAgent ?? session.userAgent),
        },
      ];
    }),
    skipDuplicates: true,
  });

  return transitioned.length;
}

/**
 * How many sessions share one transaction during the expiry sweep.
 *
 * The sweep is set-based rather than row-by-row: three round trips per chunk instead of three
 * per session, which is the difference between finishing a full batch in about a second and
 * spending the better part of a minute on it. Chunking rather than one transaction for the whole
 * batch keeps the original failure isolation — a chunk that fails loses only its own rows.
 */
const EXPIRY_CHUNK_SIZE = 50;

/**
 * Transitions sessions whose `expiresAt` has passed, in a bounded batch.
 *
 * Bounded because the cron function has a wall-clock limit and because a large sweep should be
 * resumable rather than all-or-nothing; whatever is left over is reported as `remaining` and
 * picked up by the next run.
 *
 * The UPDATE is conditioned on the row still being ACTIVE and uses RETURNING, so the audit rows
 * are written for exactly the sessions this sweep transitioned. A count alone would not be safe:
 * a session that logged out between the SELECT and the UPDATE must not be recorded as expired.
 * `skipDuplicates` plus the partial unique index on (sessionId, action) keeps a retried run from
 * writing the event twice.
 */
export async function expireDueSessions(limit = 500): Promise<{
  expired: number;
  remaining: number;
}> {
  const dueFilter = {
    status: AuthSessionStatus.ACTIVE,
    expiresAt: { lte: new Date() },
  };

  const due = await prisma.authSession.findMany({
    where: dueFilter,
    orderBy: { expiresAt: "asc" },
    take: limit,
    select: {
      id: true,
      ipAddress: true,
      userAgent: true,
      user: { select: { id: true, email: true, role: true } },
    },
  });

  let expired = 0;

  for (let offset = 0; offset < due.length; offset += EXPIRY_CHUNK_SIZE) {
    const chunk = due.slice(offset, offset + EXPIRY_CHUNK_SIZE);
    const ids = chunk.map((session) => session.id);

    try {
      expired += await prisma.$transaction(async (tx) => {
        const transitioned = await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
          UPDATE "AuthSession"
             SET "status"      = ${AuthSessionStatus.EXPIRED}::"AuthSessionStatus",
                 "endedAt"     = ${new Date()},
                 "endedReason" = ${AUDIT_REASONS.maxAgeReached}
           WHERE "id" IN (${Prisma.join(ids)})
             AND "status" = ${AuthSessionStatus.ACTIVE}::"AuthSessionStatus"
          RETURNING "id"
        `);

        if (transitioned.length === 0) return 0;

        const byId = new Map(chunk.map((session) => [session.id, session]));

        await tx.auditLog.createMany({
          data: transitioned.flatMap(({ id }) => {
            const session = byId.get(id);
            if (!session) return [];
            return [
              {
                action: AUTH_AUDIT_ACTIONS.sessionExpired,
                actorId: session.user.id,
                actorEmail: session.user.email,
                actorRole: session.user.role,
                sessionId: id,
                provider: AUTH_PROVIDERS.system,
                reason: AUDIT_REASONS.maxAgeReached,
                // createMany bypasses writeAuthAuditLog, so the same redaction is applied here.
                ipAddress: sanitiseIpAddress(session.ipAddress),
                userAgent: sanitiseUserAgent(session.userAgent),
              },
            ];
          }),
          skipDuplicates: true,
        });

        return transitioned.length;
      });
    } catch (error) {
      console.error(`[session] could not expire a chunk of ${ids.length}:`, error);
    }
  }

  const remaining = await prisma.authSession.count({
    where: {
      status: AuthSessionStatus.ACTIVE,
      expiresAt: { lte: new Date() },
    },
  });

  return { expired, remaining };
}

/**
 * Whether a session may still be used by the user the token claims to be.
 *
 * A session past `expiresAt` is unusable immediately, without waiting for the sweep to relabel it
 * — the job exists to write the audit trail, not to enforce access. Ownership is re-checked so a
 * token carrying someone else's session id gains nothing.
 */
export async function isSessionUsable(
  sessionId: string,
  userId: string,
): Promise<boolean> {
  const session = await prisma.authSession.findUnique({
    where: { id: sessionId },
    select: { status: true, expiresAt: true, userId: true },
  });

  if (!session) return false;
  if (session.userId !== userId) return false;
  if (session.status !== AuthSessionStatus.ACTIVE) return false;
  return session.expiresAt > new Date();
}
