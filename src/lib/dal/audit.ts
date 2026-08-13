import { timingSafeEqual } from "node:crypto";
import { Prisma, type Role } from "@prisma/client";
import { serverEnv } from "@/env";
import {
  hashAuditSubject,
  sanitiseIpAddress,
  sanitiseUserAgent,
} from "@/lib/audit-redaction";
import { prisma } from "@/lib/prisma";
import {
  SESSION_LIFECYCLE_ACTIONS,
  type AuditReason,
  type AuthAuditAction,
  type AuthProvider,
} from "@/lib/audit-events";

/**
 * Audit writes.
 *
 * Split out of src/lib/dal/admin.ts because that module asserts an administrator up front, and
 * authentication events are written by definition when nobody is authenticated yet. Nothing here
 * checks a viewer; the reads that do live in src/lib/dal/audit-read.ts.
 */

type PrismaLike = Prisma.TransactionClient | typeof prisma;

export type AuthAuditEntry = {
  action: AuthAuditAction;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: Role | null;
  sessionId?: string | null;
  provider?: AuthProvider | null;
  /** Raw address; hashed before it is stored. Never persisted verbatim. */
  subjectEmail?: string | null;
  reason?: AuditReason | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Prisma.InputJsonValue;
};

/**
 * Records an authentication event.
 *
 * Lifecycle events are deduplicated by a partial unique index on (sessionId, action), so a
 * retried expiry sweep or a double-fired sign-out is a no-op rather than a duplicate row.
 */
export async function writeAuthAuditLog(
  client: PrismaLike,
  entry: AuthAuditEntry,
): Promise<void> {
  const data: Prisma.AuditLogCreateInput = {
    action: entry.action,
    actorEmail: entry.actorEmail ?? null,
    actorRole: entry.actorRole ?? null,
    sessionId: entry.sessionId ?? null,
    provider: entry.provider ?? null,
    subjectHash: entry.subjectEmail
      ? hashAuditSubject(entry.subjectEmail, serverEnv.AUDIT_HASH_SECRET)
      : null,
    reason: entry.reason ?? null,
    ipAddress: sanitiseIpAddress(entry.ipAddress),
    userAgent: sanitiseUserAgent(entry.userAgent),
    ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    ...(entry.actorId ? { actor: { connect: { id: entry.actorId } } } : {}),
  };

  const dedupable =
    entry.sessionId != null && SESSION_LIFECYCLE_ACTIONS.includes(entry.action);

  try {
    await client.auditLog.create({ data });
  } catch (error) {
    if (dedupable && isUniqueViolation(error)) return;
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/**
 * Fire-and-forget variant for paths where the user-visible outcome must not depend on the
 * audit write — clearing a session cookie, for instance, has to succeed even if the database
 * is unreachable. Losing the row is the lesser failure; leaving the user signed in is not.
 */
export async function tryWriteAuthAuditLog(entry: AuthAuditEntry): Promise<void> {
  try {
    await writeAuthAuditLog(prisma, entry);
  } catch (error) {
    console.error(`[audit] could not record ${entry.action}:`, error);
  }
}

/**
 * Records a staff mutation. Called inside the same transaction as the mutation wherever
 * possible so an action can never be applied without a trace.
 *
 * The actor's email and role are snapshotted alongside the id: the id now nulls out when a user
 * is deleted, and "who did this" has to survive that.
 */
export async function writeStaffAuditLog(
  client: PrismaLike,
  entry: {
    actorId: string;
    actorEmail: string;
    actorRole: Role;
    action: string;
    targetType: string;
    targetId: string;
    sessionId?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      sessionId: entry.sessionId ?? null,
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    },
  });
}

// Reads live in src/lib/dal/audit-read.ts: they assert an administrator, and importing that
// assertion here would make this module part of an import cycle through src/auth.ts.

/** Constant-time comparison for the cron shared secret. */
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
