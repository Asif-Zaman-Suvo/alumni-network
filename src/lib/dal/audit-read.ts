import { Prisma, type Role } from "@prisma/client";
import { auditActionLabel, AUTH_AUDIT_ACTIONS, isAuthAuditAction } from "@/lib/audit-events";
import { assertAdmin } from "@/lib/dal/session";
import { prisma } from "@/lib/prisma";

/**
 * Audit history reads.
 *
 * Separate from src/lib/dal/audit.ts, which holds the writes, for two reasons. The first is
 * authorization: reads are administrator-only and assert it themselves, while writes happen
 * precisely when nobody is authenticated. The second is structural — asserting an administrator
 * means importing src/lib/dal/session.ts, which reaches src/auth.ts and from there back into the
 * audit *writers*. Keeping the readers in their own module leaves that chain acyclic.
 *
 * Every exported function here begins with assertAdmin(), matching src/lib/dal/admin.ts. Callers
 * still check the viewer first so they can choose their own failure mode (a 404 from the API, a
 * redirect from the page); the assertion here is what makes a caller that forgets fail closed.
 */

export type AuditLogRecord = {
  id: string;
  action: string;
  actionLabel: string;
  isAuthEvent: boolean;
  createdAt: Date;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: Role | null;
  targetType: string | null;
  targetId: string | null;
  sessionId: string | null;
  provider: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue;
};

export type AuditLogCursor = {
  createdAt: Date;
  id: string;
};

export type AuditLogFilters = {
  action?: string;
  actorId?: string;
  sessionId?: string;
  from?: Date;
  to?: Date;
  /** Only authentication events, only staff mutations, or both. */
  family?: "auth" | "staff";
};

export type AuditLogPage = {
  entries: AuditLogRecord[];
  nextCursor: AuditLogCursor | null;
};

export const AUDIT_PAGE_SIZE = 50;
export const AUDIT_PAGE_SIZE_MAX = 200;

const auditSelect = {
  id: true,
  action: true,
  createdAt: true,
  actorId: true,
  actorEmail: true,
  actorRole: true,
  targetType: true,
  targetId: true,
  sessionId: true,
  provider: true,
  reason: true,
  ipAddress: true,
  userAgent: true,
  metadata: true,
} as const;

function toRecord(row: {
  id: string;
  action: string;
  createdAt: Date;
  actorId: string | null;
  actorEmail: string | null;
  actorRole: Role | null;
  targetType: string | null;
  targetId: string | null;
  sessionId: string | null;
  provider: string | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Prisma.JsonValue;
}): AuditLogRecord {
  return {
    ...row,
    isAuthEvent: isAuthAuditAction(row.action),
    actionLabel: auditActionLabel(row.action),
  };
}

function buildWhere(filters: AuditLogFilters): Prisma.AuditLogWhereInput {
  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) where.action = filters.action;
  if (filters.actorId) where.actorId = filters.actorId;
  if (filters.sessionId) where.sessionId = filters.sessionId;

  if (filters.from || filters.to) {
    where.createdAt = {
      ...(filters.from ? { gte: filters.from } : {}),
      ...(filters.to ? { lte: filters.to } : {}),
    };
  }

  if (filters.family === "auth") {
    where.action = filters.action ?? { in: [...Object.values(AUTH_AUDIT_ACTIONS)] };
  } else if (filters.family === "staff") {
    where.action = filters.action ?? {
      notIn: [...Object.values(AUTH_AUDIT_ACTIONS)],
    };
  }

  return where;
}

/**
 * Keyset pagination over the audit history.
 *
 * OFFSET degrades linearly as the table grows and can skip or repeat rows when new events
 * arrive mid-page — which is guaranteed here, because the whole point is a live feed. The
 * (createdAt DESC, id DESC) index makes the cursor both stable and cheap.
 */
export async function listAuditLogPage(options: {
  filters?: AuditLogFilters;
  cursor?: AuditLogCursor | null;
  pageSize?: number;
}): Promise<AuditLogPage> {
  await assertAdmin();

  const pageSize = Math.min(
    AUDIT_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(options.pageSize ?? AUDIT_PAGE_SIZE)),
  );
  const filters = options.filters ?? {};
  const where = buildWhere(filters);
  const cursor = options.cursor;

  const rows = await prisma.auditLog.findMany({
    where: cursor
      ? {
          AND: [
            where,
            {
              OR: [
                { createdAt: { lt: cursor.createdAt } },
                { createdAt: cursor.createdAt, id: { lt: cursor.id } },
              ],
            },
          ],
        }
      : where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    // One extra row tells us whether another page exists without a second COUNT query.
    take: pageSize + 1,
    select: auditSelect,
  });

  const hasMore = rows.length > pageSize;
  const page = hasMore ? rows.slice(0, pageSize) : rows;
  const last = page.at(-1);

  return {
    entries: page.map(toRecord),
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

/**
 * Fetches events newer than a cursor, used by the live monitor to backfill anything the
 * Realtime channel dropped while the socket was down.
 */
export async function listAuditLogSince(options: {
  after: AuditLogCursor;
  filters?: AuditLogFilters;
  limit?: number;
}): Promise<AuditLogRecord[]> {
  await assertAdmin();

  const limit = Math.min(
    AUDIT_PAGE_SIZE_MAX,
    Math.max(1, Math.floor(options.limit ?? AUDIT_PAGE_SIZE)),
  );

  const rows = await prisma.auditLog.findMany({
    where: {
      AND: [
        buildWhere(options.filters ?? {}),
        {
          OR: [
            { createdAt: { gt: options.after.createdAt } },
            { createdAt: options.after.createdAt, id: { gt: options.after.id } },
          ],
        },
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit,
    select: auditSelect,
  });

  return rows.map(toRecord);
}
