"use server";

import { revalidatePath } from "next/cache";
import { unstable_update } from "@/auth";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import { homeForStatus } from "@/lib/auth-routes";
import { getViewer } from "@/lib/dal/session";
import { MAX_SUBMISSION_ATTEMPTS } from "@/lib/dal/verification";
import { sendVerificationReceived } from "@/lib/email";
import {
  decideSscLink,
  findBlockingPendingOwnerBySsc,
  findVerifiedOwnerBySsc,
  isUniqueViolation,
  mergeOAuthStubIntoUser,
  OAuthLinkConflictError,
} from "@/lib/oauth-link";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, formatRetryAfter, RATE_LIMITS } from "@/lib/rate-limit";
import { uploadCertificate } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { sscSubmissionSchema } from "@/lib/validation";

export type VerificationSubmitData = {
  redirectTo?: string;
};

/**
 * Submits SSC details for OAuth onboarding (`UNVERIFIED`) and for resubmission after
 * rejection.
 *
 * Account-linking flow (comments intentional — this is the product rule):
 * 1. Look up a VERIFIED VerificationRequest with the same roll + registration.
 * 2. If found on another User → move this session's OAuth Account rows onto that User,
 *    delete the stub, switch the JWT. That is linking, not admin approval.
 * 3. If another User already has a PENDING claim for that SSC → reject (no steal).
 * 4. Otherwise create PENDING on this User and wait for an administrator.
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
  const identity = { sscRoll, sscRegistration };

  const [verifiedOwnerId, blockingOwnerId] = await Promise.all([
    findVerifiedOwnerBySsc(identity),
    findBlockingPendingOwnerBySsc(identity),
  ]);

  const decision = decideSscLink({
    viewerId: viewer.id,
    verifiedOwnerId,
    blockingOwnerId,
  });

  if (decision.kind === "conflict") {
    return actionError(decision.message);
  }

  if (decision.kind === "merge") {
    try {
      await mergeOAuthStubIntoUser(viewer.id, decision.targetUserId);
    } catch (error) {
      if (error instanceof OAuthLinkConflictError) return actionError(error.message);
      if (isUniqueViolation(error)) {
        return actionError(
          "This social login is already linked to a different account. Contact the alumni office.",
        );
      }
      throw error;
    }

    const target = await prisma.user.findUnique({
      where: { id: decision.targetUserId },
      select: {
        status: true,
        profileComplete: true,
        role: true,
      },
    });

    await unstable_update({
      switchToUserId: decision.targetUserId,
    } as { switchToUserId: string });

    const redirectTo = homeForStatus(target?.status, {
      profileComplete: target?.profileComplete,
      isStaff: target?.role === "ADMIN" || target?.role === "MODERATOR",
    });

    revalidatePath("/onboarding");
    revalidatePath("/directory");
    revalidatePath("/settings/profile");

    return actionOk(
      { redirectTo },
      "Your social login is now linked to your existing alumni account.",
    );
  }

  let documentPath: string | null = null;
  const document = formData.get("document");
  if (document instanceof File && document.size > 0) {
    const upload = await uploadCertificate(viewer.id, document);
    if (!upload.ok) return actionError(upload.error, { document: [upload.error] });
    documentPath = upload.path;
  }

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

    // OAuth users arrive with no profile row; create a minimal one for admin approval.
    const profile = await tx.profile.findUnique({
      where: { userId: viewer.id },
      select: { id: true },
    });

    if (!profile) {
      await tx.profile.create({
        data: {
          userId: viewer.id,
          slug: await uniqueSlug(tx, fullNameOnCert),
          displayName: fullNameOnCert,
          graduationYear: passingYear,
        },
      });
    }
  });

  await sendVerificationReceived(viewer.email);

  revalidatePath("/verification-status");
  revalidatePath("/onboarding");

  return actionOk(
    { redirectTo: "/verification-status" },
    "Submitted. An administrator will review your details shortly.",
  );
}

type SlugClient = {
  profile: {
    findUnique(args: {
      where: { slug: string };
      select: { id: true };
    }): Promise<unknown>;
  };
};

async function uniqueSlug(client: SlugClient, displayName: string): Promise<string> {
  const base = slugify(displayName) || "alum";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await client.profile.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}
