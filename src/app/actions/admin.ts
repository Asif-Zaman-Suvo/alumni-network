"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import { AUDIT_REASONS } from "@/lib/audit-events";
import { getRequestContext, revokeUserSessions } from "@/lib/auth/session-lifecycle";
import { getCertificateUrl, ADMIN_REVIEW_COUNTS_TAG } from "@/lib/dal/admin";
import { writeStaffAuditLog } from "@/lib/dal/audit";
import { DIRECTORY_FILTER_OPTIONS_TAG } from "@/lib/dal/profiles";
import { assertAdmin, ForbiddenError, type Viewer } from "@/lib/dal/session";
import { sendVerificationApproved, sendVerificationRejected } from "@/lib/email";
import { Prisma, prisma } from "@/lib/prisma";
import { reviewDecisionSchema } from "@/lib/validation";

function revalidateDirectoryCaches() {
  // Next 16 requires a cache profile as the second argument.
  revalidateTag(DIRECTORY_FILTER_OPTIONS_TAG, "max");
  revalidateTag(ADMIN_REVIEW_COUNTS_TAG, "max");
  revalidatePath("/directory");
  revalidatePath("/admin");
}

/**
 * Admin mutations. Authorisation is asserted here (not only in the proxy) and every write
 * is paired with an audit entry inside the same transaction.
 */

/**
 * Snapshots who performed an action, including the session it came from. Centralised so a new
 * action cannot accidentally omit the actor identity the audit table now depends on.
 */
function auditActor(actor: Viewer) {
  return {
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    sessionId: actor.sessionId,
  };
}

/**
 * Signed certificate URLs are minted on demand rather than embedded in the queue payload,
 * so the two minute TTL starts when a reviewer actually opens a document.
 */
export async function getCertificateUrlAction(
  requestId: string,
): Promise<ActionResult<{ url: string }>> {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return actionError(error.message);
    throw error;
  }

  const url = await getCertificateUrl(requestId);
  if (!url) return actionError("No document was attached to this request.");

  return actionOk({ url });
}

type ReviewOutcome = { decided: number };

export async function reviewVerificationAction(
  formData: FormData,
): Promise<ActionResult<ReviewOutcome>> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return actionError(error.message);
    throw error;
  }

  const parsed = reviewDecisionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { requestId, decision, reviewNote } = parsed.data;

  const request = await prisma.verificationRequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      userId: true,
      fullNameOnCert: true,
      passingYear: true,
      sscRoll: true,
      sscRegistration: true,
      user: { select: { email: true } },
    },
  });

  if (!request) return actionError("That request no longer exists.");
  if (request.status !== "PENDING") {
    return actionError("That request has already been decided.");
  }

  if (decision === "APPROVE") {
    const alreadyVerified = await prisma.verificationRequest.findFirst({
      where: {
        status: "VERIFIED",
        sscRoll: request.sscRoll,
        sscRegistration: request.sscRegistration,
        id: { not: request.id },
        user: { deletedAt: null },
      },
      select: { id: true },
    });
    if (alreadyVerified) {
      return actionError(
        "These SSC details are already approved on another account. Investigate before approving this one.",
      );
    }
  }

  const nextStatus = decision === "APPROVE" ? "VERIFIED" : "REJECTED";

  try {
    await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.update({
        where: { id: request.id },
        data: {
          status: nextStatus,
          reviewedById: actor.id,
          reviewedAt: new Date(),
          reviewNote: reviewNote ?? null,
        },
      });

      await tx.user.update({
        where: { id: request.userId },
        data: { status: nextStatus },
      });

      await writeStaffAuditLog(tx, {
        ...auditActor(actor),
        action: decision === "APPROVE" ? "verification.approve" : "verification.reject",
        targetType: "VerificationRequest",
        targetId: request.id,
        metadata: {
          userId: request.userId,
          passingYear: request.passingYear,
          ...(reviewNote ? { reviewNote } : {}),
        },
      });
    });
  } catch (error) {
    // The partial unique index on VERIFIED rows is the last line of defence against the
    // same SSC identity being approved on two accounts.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return actionError(
        "These SSC details are already approved on another account. Investigate before approving this one.",
      );
    }
    throw error;
  }

  if (decision === "APPROVE") {
    await sendVerificationApproved(request.user.email, request.fullNameOnCert);
  } else {
    await sendVerificationRejected(request.user.email, reviewNote ?? "No reason provided.");
  }

  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
  revalidateDirectoryCaches();

  return actionOk(
    { decided: 1 },
    decision === "APPROVE" ? "Approved and notified." : "Rejected and notified.",
  );
}

const bulkApproveSchema = z.object({
  requestIds: z.array(z.string().min(1)).min(1, "Select at least one request").max(100),
});

/**
 * Bulk approval by batch. Manual review of a whole school does not scale one row at a time,
 * so a reviewer who has verified a printed batch list can clear it in one action. Duplicate
 * SSC identities are skipped rather than aborting the whole batch.
 */
export async function bulkApproveAction(
  requestIds: string[],
): Promise<ActionResult<{ approved: number; skipped: number }>> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return actionError(error.message);
    throw error;
  }

  const parsed = bulkApproveSchema.safeParse({ requestIds });
  if (!parsed.success) return fromZodError(parsed.error);

  const requests = await prisma.verificationRequest.findMany({
    where: { id: { in: parsed.data.requestIds }, status: "PENDING" },
    select: {
      id: true,
      userId: true,
      fullNameOnCert: true,
      sscRoll: true,
      sscRegistration: true,
      user: { select: { email: true } },
    },
  });

  let approved = 0;
  const notify: Array<{ email: string; name: string }> = [];

  for (const request of requests) {
    const alreadyVerified = await prisma.verificationRequest.findFirst({
      where: {
        status: "VERIFIED",
        sscRoll: request.sscRoll,
        sscRegistration: request.sscRegistration,
        id: { not: request.id },
        user: { deletedAt: null },
      },
      select: { id: true },
    });
    if (alreadyVerified) continue;

    try {
      await prisma.$transaction(async (tx) => {
        await tx.verificationRequest.update({
          where: { id: request.id },
          data: {
            status: "VERIFIED",
            reviewedById: actor.id,
            reviewedAt: new Date(),
          },
        });

        await tx.user.update({ where: { id: request.userId }, data: { status: "VERIFIED" } });

        await writeStaffAuditLog(tx, {
          ...auditActor(actor),
          action: "verification.approve.bulk",
          targetType: "VerificationRequest",
          targetId: request.id,
          metadata: { userId: request.userId },
        });
      });

      approved += 1;
      notify.push({ email: request.user.email, name: request.fullNameOnCert });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }

  await Promise.all(notify.map((item) => sendVerificationApproved(item.email, item.name)));

  revalidatePath("/admin/verifications");
  revalidatePath("/admin");
  revalidateDirectoryCaches();

  const skipped = requests.length - approved;

  return actionOk(
    { approved, skipped },
    skipped > 0
      ? `Approved ${approved}. Skipped ${skipped} with SSC details already approved elsewhere.`
      : `Approved ${approved}.`,
  );
}

const roleChangeSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["ADMIN", "ALUMNI"]),
});

export async function changeUserRoleAction(formData: FormData): Promise<ActionResult> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return actionError(error.message);
    throw error;
  }

  const parsed = roleChangeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { userId, role } = parsed.data;

  if (userId === actor.id && role !== "ADMIN") {
    return actionError("You cannot remove your own administrator access.");
  }

  const context = await getRequestContext();

  await prisma.$transaction(async (tx) => {
    const previous = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { role: true },
    });

    await tx.user.update({ where: { id: userId }, data: { role } });
    await writeStaffAuditLog(tx, {
      ...auditActor(actor),
      action: "user.role.change",
      targetType: "User",
      targetId: userId,
      metadata: { role, previousRole: previous.role },
    });

    // Role claims live in the JWT and only refresh hourly, so a demoted administrator would
    // otherwise keep admin access — and an open Realtime subscription — until that refresh.
    // Ending the sessions forces a re-issue with the new role.
    if (previous.role === "ADMIN" && role !== "ADMIN") {
      await revokeUserSessions(tx, {
        userId,
        reason: AUDIT_REASONS.adminRevoked,
        context,
      });
    }
  });

  revalidatePath("/admin/users");
  revalidateTag(ADMIN_REVIEW_COUNTS_TAG, "max");

  return actionOk(undefined, "Role updated.");
}

const suspensionSchema = z.object({
  userId: z.string().min(1),
  action: z.enum(["SUSPEND", "RESTORE"]),
});

/**
 * Soft delete. Rows are retained so the audit trail and any approved SSC identity stay
 * intact; the DAL treats `deletedAt` as invisible everywhere.
 */
export async function setUserSuspensionAction(formData: FormData): Promise<ActionResult> {
  let actor;
  try {
    actor = await assertAdmin();
  } catch (error) {
    if (error instanceof ForbiddenError) return actionError(error.message);
    throw error;
  }

  const parsed = suspensionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { userId, action } = parsed.data;

  if (userId === actor.id) {
    return actionError("You cannot suspend your own account.");
  }

  const context = await getRequestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { deletedAt: action === "SUSPEND" ? new Date() : null },
    });
    await writeStaffAuditLog(tx, {
      ...auditActor(actor),
      action: action === "SUSPEND" ? "user.suspend" : "user.restore",
      targetType: "User",
      targetId: userId,
    });

    // Suspension has to take effect now, not whenever the suspended user's JWT next refreshes.
    // Same transaction as the soft delete: a suspension that leaves a live session behind is
    // the exact failure this table exists to prevent.
    if (action === "SUSPEND") {
      await revokeUserSessions(tx, {
        userId,
        reason: AUDIT_REASONS.accountSuspended,
        context,
      });
    }
  });

  revalidatePath("/admin/users");
  revalidateTag(ADMIN_REVIEW_COUNTS_TAG, "max");
  revalidatePath("/admin");

  return actionOk(
    undefined,
    action === "SUSPEND" ? "Account suspended." : "Account restored.",
  );
}
