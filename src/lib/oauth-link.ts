import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export { decideSscLink, maskEmail, type SscLinkDecision } from "@/lib/oauth-link-decision";

/**
 * Account helpers for OAuth + SSC identity.
 *
 * Auth.js `Account` = "this Google login works".
 * `VerificationRequest` (VERIFIED SSC) = "this is the same alum".
 * Never merge solely because OAuth emails match.
 * Onboarding does not auto-link Google onto an existing alumni — it blocks and redirects.
 */

export const OAUTH_LINK_COOKIE = "oauth_link_user";
const OAUTH_LINK_MAX_AGE_SEC = 10 * 60;

export type SscIdentity = {
  sscRoll: string;
  sscRegistration: string;
  passingYear: number;
};

export type VerifiedAlumniMatch = {
  userId: string;
  email: string;
  hasPassword: boolean;
};

export async function findVerifiedAlumniBySsc(
  identity: SscIdentity,
): Promise<VerifiedAlumniMatch | null> {
  const row = await prisma.verificationRequest.findFirst({
    where: {
      status: "VERIFIED",
      sscRoll: identity.sscRoll,
      sscRegistration: identity.sscRegistration,
      passingYear: identity.passingYear,
      user: { deletedAt: null },
    },
    select: {
      userId: true,
      user: { select: { email: true, passwordHash: true } },
    },
    orderBy: { reviewedAt: "desc" },
  });

  if (!row) return null;

  return {
    userId: row.userId,
    email: row.user.email,
    hasPassword: Boolean(row.user.passwordHash),
  };
}

/** @deprecated Prefer findVerifiedAlumniBySsc — kept for any leftover call sites. */
export async function findVerifiedOwnerBySsc(
  identity: Omit<SscIdentity, "passingYear"> & { passingYear?: number },
): Promise<string | null> {
  if (identity.passingYear === undefined) {
    const row = await prisma.verificationRequest.findFirst({
      where: {
        status: "VERIFIED",
        sscRoll: identity.sscRoll,
        sscRegistration: identity.sscRegistration,
        user: { deletedAt: null },
      },
      select: { userId: true },
      orderBy: { reviewedAt: "desc" },
    });
    return row?.userId ?? null;
  }

  const match = await findVerifiedAlumniBySsc(identity as SscIdentity);
  return match?.userId ?? null;
}

/** PENDING claim owned by someone else — do not steal or double-queue. */
export async function findBlockingPendingOwnerBySsc(
  identity: SscIdentity,
): Promise<string | null> {
  const row = await prisma.verificationRequest.findFirst({
    where: {
      status: "PENDING",
      sscRoll: identity.sscRoll,
      sscRegistration: identity.sscRegistration,
      passingYear: identity.passingYear,
      user: { deletedAt: null },
    },
    select: { userId: true },
    orderBy: { createdAt: "asc" },
  });
  return row?.userId ?? null;
}

/**
 * Delete an OAuth stub user created by Auth.js before SSC was confirmed.
 * Cascade removes Account / Profile / tokens so the identity is not left orphaned.
 */
export async function deleteOAuthStubUser(stubUserId: string): Promise<void> {
  await prisma.user.delete({ where: { id: stubUserId } });
}

/**
 * Settings "Link Google": move OAuth Account from a fresh stub onto the verified session user.
 * Not used by onboarding (onboarding blocks instead of merging).
 */
export async function mergeOAuthStubIntoUser(
  stubUserId: string,
  targetUserId: string,
): Promise<void> {
  if (stubUserId === targetUserId) return;

  await prisma.$transaction(async (tx) => {
    const [stub, target] = await Promise.all([
      tx.user.findUnique({
        where: { id: stubUserId },
        select: { id: true, deletedAt: true },
      }),
      tx.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, deletedAt: true },
      }),
    ]);

    if (!stub || stub.deletedAt) {
      throw new Error("OAuth stub account no longer exists.");
    }
    if (!target || target.deletedAt) {
      throw new Error("Target alumni account no longer exists.");
    }

    try {
      await tx.account.updateMany({
        where: { userId: stubUserId },
        data: { userId: targetUserId },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new OAuthLinkConflictError(
          "This social login is already linked to a different account.",
        );
      }
      throw error;
    }

    await tx.user.delete({ where: { id: stubUserId } });
  });
}

export class OAuthLinkConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OAuthLinkConflictError";
  }
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002"
  );
}

/** Verified session user wants to attach Google without re-entering SSC. */
export async function setOAuthLinkIntent(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(OAUTH_LINK_COOKIE, userId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_LINK_MAX_AGE_SEC,
  });
}

export async function consumeOAuthLinkIntent(): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(OAUTH_LINK_COOKIE)?.value ?? null;
  if (value) jar.delete(OAUTH_LINK_COOKIE);
  return value;
}

export async function clearOAuthLinkIntent(): Promise<void> {
  const jar = await cookies();
  jar.delete(OAUTH_LINK_COOKIE);
}

export async function listLinkedProviders(userId: string) {
  return prisma.account.findMany({
    where: { userId },
    select: { provider: true, providerAccountId: true, createdAt: true },
    orderBy: { provider: "asc" },
  });
}
