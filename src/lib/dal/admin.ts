import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { assertStaff, type Viewer } from "@/lib/dal/session";
import { createCertificateSignedUrl } from "@/lib/storage";
import { Prisma, type Role, type UserStatus } from "@prisma/client";

/**
 * Staff-only reads and writes.
 *
 * This is the ONLY module permitted to select sscRoll / sscRegistration or to mint a signed
 * certificate URL. Keeping it separate from src/lib/dal/profiles.ts means a careless `select`
 * in the public profile path cannot expose SSC identifiers, no matter what it asks for.
 * Every function begins with assertStaff().
 */

export type ReviewQueueItem = {
  id: string;
  createdAt: Date;
  fullNameOnCert: string;
  passingYear: number;
  sscRoll: string;
  sscRegistration: string;
  hasDocument: boolean;
  status: UserStatus;
  reviewNote: string | null;
  attemptNumber: number;
  user: {
    id: string;
    email: string;
    status: UserStatus;
  };
  /** True when this SSC identity is already approved on another account. */
  duplicateOfVerified: boolean;
};

export type ReviewQueueFilters = {
  status?: UserStatus;
  passingYear?: number;
  q?: string;
  page?: number;
  pageSize?: number;
};

export const REVIEW_PAGE_SIZE = 20;

export type ReviewQueue = {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  totalPages: number;
};

export async function getReviewQueue(filters: ReviewQueueFilters): Promise<ReviewQueue> {
  await assertStaff();

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = Math.max(1, Math.floor(filters.pageSize ?? REVIEW_PAGE_SIZE));
  const term = filters.q?.trim();
  const status = filters.status ?? "PENDING";
  const offset = (page - 1) * pageSize;

  const conditions: Prisma.Sql[] = [
    Prisma.sql`vr."status" = ${status}::"UserStatus"`,
  ];
  if (filters.passingYear !== undefined) {
    conditions.push(Prisma.sql`vr."passingYear" = ${filters.passingYear}`);
  }
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      vr."fullNameOnCert" ILIKE ${pattern}
      OR vr."sscRoll" LIKE ${pattern}
      OR vr."sscRegistration" LIKE ${pattern}
      OR u."email" ILIKE ${pattern}
    )`);
  }

  const where = Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;

  type QueueRow = {
    id: string;
    createdAt: Date;
    fullNameOnCert: string;
    passingYear: number;
    sscRoll: string;
    sscRegistration: string;
    hasDocument: boolean;
    status: UserStatus;
    reviewNote: string | null;
    userId: string;
    userEmail: string;
    userStatus: UserStatus;
    total: number;
    attemptNumber: number;
    duplicateOfVerified: boolean;
  };

  // One round-trip: page rows + total + attempt count + duplicate flag.
  // Previously: findMany + count + duplicates findMany + groupBy (4 RTs, serialized ≈ 5s+).
  const rows = await prisma.$queryRaw<QueueRow[]>`
    SELECT
      vr."id",
      vr."createdAt",
      vr."fullNameOnCert",
      vr."passingYear",
      vr."sscRoll",
      vr."sscRegistration",
      (vr."documentPath" IS NOT NULL) AS "hasDocument",
      vr."status",
      vr."reviewNote",
      vr."userId",
      u."email" AS "userEmail",
      u."status" AS "userStatus",
      COUNT(*) OVER()::int AS "total",
      (
        SELECT COUNT(*)::int
        FROM "VerificationRequest" vr2
        WHERE vr2."userId" = vr."userId"
      ) AS "attemptNumber",
      EXISTS (
        SELECT 1
        FROM "VerificationRequest" d
        WHERE d."status" = ${"VERIFIED"}::"UserStatus"
          AND d."sscRoll" = vr."sscRoll"
          AND d."sscRegistration" = vr."sscRegistration"
          AND d."passingYear" = vr."passingYear"
          AND d."id" <> vr."id"
      ) AS "duplicateOfVerified"
    FROM "VerificationRequest" vr
    INNER JOIN "User" u ON u."id" = vr."userId"
    ${where}
    ORDER BY vr."createdAt" ASC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows[0]?.total ?? 0;

  return {
    items: rows.map((row) => ({
      id: row.id,
      createdAt: row.createdAt,
      fullNameOnCert: row.fullNameOnCert,
      passingYear: row.passingYear,
      sscRoll: row.sscRoll,
      sscRegistration: row.sscRegistration,
      hasDocument: row.hasDocument,
      status: row.status,
      reviewNote: row.reviewNote,
      attemptNumber: row.attemptNumber,
      user: {
        id: row.userId,
        email: row.userEmail,
        status: row.userStatus,
      },
      duplicateOfVerified: row.duplicateOfVerified,
    })),
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * Signed URL for a submitted certificate. TTL is deliberately short so a URL copied out of
 * the admin UI cannot be shared.
 */
export async function getCertificateUrl(requestId: string): Promise<string | null> {
  await assertStaff();

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: { documentPath: true },
  });

  if (!request?.documentPath) return null;
  return createCertificateSignedUrl(request.documentPath);
}

export type ReviewCounts = {
  pending: number;
  verified: number;
  rejected: number;
  unverified: number;
  oldestPendingAt: Date | null;
  /** Computed here rather than in the page, so rendering stays a pure function of its data. */
  oldestPendingAgeDays: number;
};

export const ADMIN_REVIEW_COUNTS_TAG = "admin-review-counts";

type ReviewCountsPayload = {
  pending: number;
  verified: number;
  rejected: number;
  unverified: number;
  /** ISO string — unstable_cache JSON-serializes Date. */
  oldestPendingAt: string | null;
};

const loadReviewCounts = unstable_cache(
  async (): Promise<ReviewCountsPayload> => {
    const rows = await prisma.$queryRaw<
      Array<{
        pending: number;
        verified: number;
        rejected: number;
        unverified: number;
        oldestPendingAt: Date | null;
      }>
    >`
      SELECT
        COUNT(*) FILTER (WHERE u."status" = ${"PENDING"}::"UserStatus")::int AS "pending",
        COUNT(*) FILTER (WHERE u."status" = ${"VERIFIED"}::"UserStatus")::int AS "verified",
        COUNT(*) FILTER (WHERE u."status" = ${"REJECTED"}::"UserStatus")::int AS "rejected",
        COUNT(*) FILTER (WHERE u."status" = ${"UNVERIFIED"}::"UserStatus")::int AS "unverified",
        (
          SELECT MIN(vr."createdAt")
          FROM "VerificationRequest" vr
          WHERE vr."status" = ${"PENDING"}::"UserStatus"
        ) AS "oldestPendingAt"
      FROM "User" u
      WHERE u."deletedAt" IS NULL
    `;

    const row = rows[0];
    return {
      pending: row?.pending ?? 0,
      verified: row?.verified ?? 0,
      rejected: row?.rejected ?? 0,
      unverified: row?.unverified ?? 0,
      oldestPendingAt: row?.oldestPendingAt ? row.oldestPendingAt.toISOString() : null,
    };
  },
  ["admin-review-counts-v1"],
  { revalidate: 30, tags: [ADMIN_REVIEW_COUNTS_TAG] },
);

export async function getReviewCounts(): Promise<ReviewCounts> {
  await assertStaff();

  const cached = await loadReviewCounts();
  const oldestPendingAt = cached.oldestPendingAt ? new Date(cached.oldestPendingAt) : null;

  return {
    pending: cached.pending,
    verified: cached.verified,
    rejected: cached.rejected,
    unverified: cached.unverified,
    oldestPendingAt,
    oldestPendingAgeDays: oldestPendingAt
      ? (Date.now() - oldestPendingAt.getTime()) / 86_400_000
      : 0,
  };
}

export type ManagedUser = {
  id: string;
  email: string;
  role: Role;
  status: UserStatus;
  createdAt: Date;
  deletedAt: Date | null;
  displayName: string | null;
  slug: string | null;
  graduationYear: number | null;
};

export async function listUsers(filters: {
  q?: string;
  status?: UserStatus;
  role?: Role;
  page?: number;
}): Promise<{ users: ManagedUser[]; total: number; page: number; totalPages: number }> {
  await assertStaff();

  const page = Math.max(1, Math.floor(filters.page ?? 1));
  const pageSize = REVIEW_PAGE_SIZE;
  const term = filters.q?.trim();
  const offset = (page - 1) * pageSize;

  const conditions: Prisma.Sql[] = [];
  if (filters.status) {
    conditions.push(Prisma.sql`u."status" = ${filters.status}::"UserStatus"`);
  }
  if (filters.role) {
    conditions.push(Prisma.sql`u."role" = ${filters.role}::"Role"`);
  }
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(Prisma.sql`(
      u."email" ILIKE ${pattern}
      OR p."displayName" ILIKE ${pattern}
    )`);
  }

  const where =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`
      : Prisma.sql``;

  type UserRow = {
    id: string;
    email: string;
    role: Role;
    status: UserStatus;
    createdAt: Date;
    deletedAt: Date | null;
    displayName: string | null;
    slug: string | null;
    graduationYear: number | null;
    total: number;
  };

  const rows = await prisma.$queryRaw<UserRow[]>`
    SELECT
      u."id",
      u."email",
      u."role",
      u."status",
      u."createdAt",
      u."deletedAt",
      p."displayName",
      p."slug",
      p."graduationYear",
      COUNT(*) OVER()::int AS "total"
    FROM "User" u
    LEFT JOIN "Profile" p ON p."userId" = u."id"
    ${where}
    ORDER BY u."createdAt" DESC
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows[0]?.total ?? 0;

  return {
    users: rows.map(({ total: _total, ...user }) => user),
    total,
    page,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type AuditEntry = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  createdAt: Date;
  metadata: Prisma.JsonValue;
  actorEmail: string;
};

export async function listAuditLog(limit = 50): Promise<AuditEntry[]> {
  await assertStaff();

  const entries = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      targetType: true,
      targetId: true,
      createdAt: true,
      metadata: true,
      actor: { select: { email: true } },
    },
  });

  return entries.map((entry) => ({
    id: entry.id,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    createdAt: entry.createdAt,
    metadata: entry.metadata,
    actorEmail: entry.actor.email,
  }));
}

/**
 * Append-only record of every staff mutation. Called inside the same transaction as the
 * mutation wherever possible so an action can never be applied without a trace.
 */
export async function writeAuditLog(
  client: Prisma.TransactionClient | typeof prisma,
  entry: {
    actorId: string;
    action: string;
    targetType: string;
    targetId: string;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await client.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      ...(entry.metadata === undefined ? {} : { metadata: entry.metadata }),
    },
  });
}

export type { Viewer };
