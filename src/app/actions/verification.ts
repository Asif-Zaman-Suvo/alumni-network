"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import { getViewer } from "@/lib/dal/session";
import { MAX_SUBMISSION_ATTEMPTS } from "@/lib/dal/verification";
import { sendVerificationReceived } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, formatRetryAfter, RATE_LIMITS } from "@/lib/rate-limit";
import { uploadCertificate } from "@/lib/storage";
import { slugify } from "@/lib/utils";
import { sscSubmissionSchema } from "@/lib/validation";

/**
 * Submits SSC details for manual review. Used by the /onboarding page (Google sign-ups,
 * which cannot collect these fields during OAuth) and by /verification-status for
 * resubmission after a rejection.
 *
 * There is no roster to match against, so this action never approves anything. It records
 * the claim, moves the user to PENDING and hands the decision to a human.
 */
export async function submitVerificationAction(formData: FormData): Promise<ActionResult> {
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

  // Guards against flooding the review queue. There is no identity to brute-force here
  // (nothing is matched automatically), so this is a fairness limit rather than a
  // defence against enumeration.
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

    // OAuth users arrive with no profile row at all; create a minimal one so the account
    // is complete the moment an admin approves it.
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

  return actionOk(undefined, "Submitted. An administrator will review your details shortly.");
}

type SlugClient = {
  profile: { findUnique(args: { where: { slug: string }; select: { id: true } }): Promise<unknown> };
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
