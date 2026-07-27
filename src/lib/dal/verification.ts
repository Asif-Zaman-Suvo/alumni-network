import { prisma } from "@/lib/prisma";
import { requireViewer } from "@/lib/dal/session";
import type { UserStatus } from "@prisma/client";

/**
 * A user's own view of their verification history. Deliberately excludes documentPath —
 * the file is evidence for the reviewer, not a download for the submitter.
 */
export type OwnVerificationRequest = {
  id: string;
  createdAt: Date;
  passingYear: number;
  fullNameOnCert: string;
  /** Last four digits only; enough to recognise which submission this was. */
  sscRollMasked: string;
  hasDocument: boolean;
  status: UserStatus;
  reviewNote: string | null;
  reviewedAt: Date | null;
};

export const MAX_SUBMISSION_ATTEMPTS = 3;

export type OwnVerificationState = {
  status: UserStatus;
  attempts: OwnVerificationRequest[];
  attemptsUsed: number;
  attemptsRemaining: number;
  canResubmit: boolean;
  latest: OwnVerificationRequest | null;
};

function mask(value: string): string {
  return value.length <= 4 ? value : `${"•".repeat(value.length - 4)}${value.slice(-4)}`;
}

export async function getOwnVerificationState(): Promise<OwnVerificationState> {
  const viewer = await requireViewer();

  const requests = await prisma.verificationRequest.findMany({
    where: { userId: viewer.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      passingYear: true,
      fullNameOnCert: true,
      sscRoll: true,
      documentPath: true,
      status: true,
      reviewNote: true,
      reviewedAt: true,
    },
  });

  const attempts: OwnVerificationRequest[] = requests.map((request) => ({
    id: request.id,
    createdAt: request.createdAt,
    passingYear: request.passingYear,
    fullNameOnCert: request.fullNameOnCert,
    sscRollMasked: mask(request.sscRoll),
    hasDocument: Boolean(request.documentPath),
    status: request.status,
    reviewNote: request.reviewNote,
    reviewedAt: request.reviewedAt,
  }));

  const attemptsUsed = attempts.length;

  return {
    status: viewer.status,
    attempts,
    attemptsUsed,
    attemptsRemaining: Math.max(0, MAX_SUBMISSION_ATTEMPTS - attemptsUsed),
    canResubmit:
      (viewer.status === "REJECTED" || viewer.status === "UNVERIFIED") &&
      attemptsUsed < MAX_SUBMISSION_ATTEMPTS,
    latest: attempts[0] ?? null,
  };
}
