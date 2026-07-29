"use server";

import { revalidatePath } from "next/cache";
import { signOut } from "@/auth";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/dal/session";
import { MAX_SUBMISSION_ATTEMPTS } from "@/lib/dal/verification";
import { sendVerificationReceived } from "@/lib/email";
import {
  decideSscLink,
  deleteOAuthStubUser,
  findBlockingPendingOwnerBySsc,
  findVerifiedAlumniBySsc,
  maskEmail,
} from "@/lib/oauth-link";
import { prisma } from "@/lib/prisma";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { consumeRateLimit, formatRetryAfter, RATE_LIMITS } from "@/lib/rate-limit";
import { uploadCertificate } from "@/lib/storage";
import { createProfileWithUniqueSlug } from "@/lib/unique-slug";
import { sscSubmissionSchema } from "@/lib/validation";

export type VerificationSubmitData = {
  redirectTo?: string;
  /**
   * Case 1: SSC matches a VERIFIED alumni. Full email is never returned — only a mask.
   * The OAuth stub has been deleted and the session cleared.
   */
  existingAccount?: {
    maskedEmail: string;
    hasPassword: boolean;
  };
};

/**
 * Submits SSC details for OAuth onboarding (`UNVERIFIED`) and for resubmission after
 * rejection.
 *
 * One alumni = one account = one email:
 * 1. VERIFIED match on roll + registration + passing year → block. Do not merge Google,
 *    do not enqueue admin review. Delete the Auth.js stub, sign out, return masked email.
 * 2. Another user already PENDING for that identity → conflict (no email leak).
 * 3. Otherwise create PENDING on this stub and wait for an administrator.
 *
 * OAuth email is never used to decide which alumni record this is.
 */
export async function submitVerificationAction(
  formData: FormData,
): Promise<ActionResult<VerificationSubmitData>> {
  const viewer = await getViewer();
  if (!viewer) return actionError("Please sign in again.");

  if (viewer.status === "VERIFIED") {
    return actionError("Your account is already verified.");
  }
  if (viewer.status === "PENDING") {
    return actionError("You already have a request awaiting review.");
  }

  const parsed = sscSubmissionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const attemptsUsed = await prisma.verificationRequest.count({
    where: { userId: viewer.id },
  });
  if (attemptsUsed >= MAX_SUBMISSION_ATTEMPTS) {
    return actionError(
      "You have used all three submission attempts. Please contact the alumni office directly.",
    );
  }

  const limit = await consumeRateLimit({
    bucket: `verification:submit:${viewer.id}`,
    ...RATE_LIMITS.verificationSubmit,
  });
  if (!limit.ok) {
    return actionError(
      `You can submit up to ${RATE_LIMITS.verificationSubmit.limit} requests per day. Try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  const { fullNameOnCert, sscRoll, sscRegistration, passingYear } = parsed.data;
  const identity = { sscRoll, sscRegistration, passingYear };

  const [verifiedMatch, blockingOwnerId] = await Promise.all([
    findVerifiedAlumniBySsc(identity),
    findBlockingPendingOwnerBySsc(identity),
  ]);

  const decision = decideSscLink({
    viewerId: viewer.id,
    verifiedOwnerId: verifiedMatch?.userId ?? null,
    blockingOwnerId,
  });

  if (decision.kind === "conflict") {
    return actionError(decision.message);
  }

  if (decision.kind === "block_existing" && verifiedMatch) {
    // Only delete Auth.js OAuth stubs (UNVERIFIED). REJECTED resubmits must not wipe the user.
    if (viewer.status === "UNVERIFIED") {
      await deleteOAuthStubUser(viewer.id);
      await signOut({ redirect: false });

      revalidatePath("/onboarding");
      revalidatePath("/login");

      return actionError(
        "We found an existing account associated with this alumni record. Please sign in using the registered email instead.",
        undefined,
        {
          existingAccount: {
            maskedEmail: maskEmail(verifiedMatch.email),
            hasPassword: verifiedMatch.hasPassword,
          },
        },
      );
    }

    return actionError(
      "An alumni account with these SSC details already exists. Sign in with that account instead.",
      {
        sscRoll: ["These SSC details are already registered."],
        sscRegistration: ["These SSC details are already registered."],
      },
    );
  }

  let documentPath: string | null = null;
  const document = formData.get("document");
  if (document instanceof File && document.size > 0) {
    const upload = await uploadCertificate(viewer.id, document);
    if (!upload.ok) return actionError(upload.error, { document: [upload.error] });
    documentPath = upload.path;
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.verificationRequest.create({
        data: {
          userId: viewer.id,
          sscRoll,
          sscRegistration,
          passingYear,
          fullNameOnCert,
          documentPath,
          status: "PENDING",
        },
      });

      await tx.user.update({
        where: { id: viewer.id },
        data: { status: "PENDING" },
      });

      const profile = await tx.profile.findUnique({
        where: { userId: viewer.id },
        select: { id: true },
      });

      if (!profile) {
        await createProfileWithUniqueSlug(tx, {
          userId: viewer.id,
          displayName: fullNameOnCert,
          graduationYear: passingYear,
        });
      }
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return actionError(
        "These SSC details are already registered or under review for another account.",
        {
          sscRoll: ["These SSC details are already registered."],
          sscRegistration: ["These SSC details are already registered."],
        },
      );
    }
    throw error;
  }

  await sendVerificationReceived(viewer.email);

  revalidatePath("/verification-status");
  revalidatePath("/onboarding");

  return actionOk(
    { redirectTo: "/verification-status" },
    "Your verification request has been submitted successfully. Our administrators will review your information and notify you once it has been approved.",
  );
}
