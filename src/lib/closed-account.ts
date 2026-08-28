import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type PrismaLike = Prisma.TransactionClient | typeof prisma;

/** RFC 2606 `.invalid` — never routable, never collides with a real inbox. */
export function closedAccountEmail(userId: string): string {
  return `closed+${userId}@deleted.invalid`;
}

/**
 * A live row with this address blocks signup. A closed row must not — directory
 * already hides `deletedAt`, but `User.email` is still globally unique.
 */
export function emailBlocksRegistration(
  existing: { deletedAt: Date | null } | null,
): boolean {
  return existing !== null && existing.deletedAt === null;
}

/**
 * Frees identity so the same person can register or Google-sign-in again.
 * The User row stays for audit; SSC uniqueness and OAuth Account PKs do not.
 */
export async function releaseClosedAccountIdentity(
  tx: PrismaLike,
  userId: string,
): Promise<void> {
  await tx.account.deleteMany({ where: { userId } });
  await tx.verificationRequest.updateMany({
    where: { userId, status: { in: ["PENDING", "VERIFIED"] } },
    data: {
      status: "REJECTED",
      reviewNote: "Account closed by member.",
      reviewedAt: new Date(),
    },
  });
  await tx.user.update({
    where: { id: userId },
    data: {
      email: closedAccountEmail(userId),
      passwordHash: null,
      emailVerified: null,
      deletedAt: new Date(),
    },
  });
}
