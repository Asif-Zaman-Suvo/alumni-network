"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { clientEnv } from "@/env";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import {
  AUDIT_REASONS,
  AUTH_AUDIT_ACTIONS,
  AUTH_PROVIDERS,
} from "@/lib/audit-events";
import { getRequestContext, revokeUserSessions } from "@/lib/auth/session-lifecycle";
import { tryWriteAuthAuditLog } from "@/lib/dal/audit";
import { sendEmailVerification, sendPasswordReset } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, formatRetryAfter, RATE_LIMITS } from "@/lib/rate-limit";
import {
  createToken,
  hashToken,
  EMAIL_VERIFICATION_TTL_MS,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/tokens";
import { getViewer } from "@/lib/dal/session";
import {
  findBlockingPendingOwnerBySsc,
  findVerifiedAlumniBySsc,
} from "@/lib/oauth-link";
import { isUniqueViolation, uniqueViolationMatches } from "@/lib/prisma-errors";
import { emailBlocksRegistration } from "@/lib/closed-account";
import { createProfileWithUniqueSlug } from "@/lib/unique-slug";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

const SSC_TAKEN_FIELD_ERRORS = {
  fullName: ["These SSC details are already registered."],
  sscRoll: ["These SSC details are already registered."],
  sscRegistration: ["These SSC details are already registered."],
};

/**
 * Registration creates the account AND the first verification request in one transaction.
 * A user is never left in a state where they have signed up but the admin has nothing to
 * review, which is the failure mode that generates support requests.
 */
export async function registerAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password, fullName, gender, sscRoll, sscRegistration, passingYear } = parsed.data;

  const limit = await consumeRateLimit({
    bucket: `register:${email}`,
    ...RATE_LIMITS.register,
  });
  if (!limit.ok) {
    return actionError(
      `Too many attempts. Try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, deletedAt: true },
  });
  if (emailBlocksRegistration(existing)) {
    return actionError("An account with this email already exists.", {
      email: ["An account with this email already exists."],
    });
  }

  // Soft pre-check for UX. Integrity is enforced by partial unique indexes on PENDING/VERIFIED.
  const identity = { sscRoll, sscRegistration, passingYear, fullNameOnCert: fullName };
  const [verifiedMatch, blockingOwnerId] = await Promise.all([
    findVerifiedAlumniBySsc(identity),
    findBlockingPendingOwnerBySsc(identity),
  ]);
  if (verifiedMatch || blockingOwnerId) {
    return actionError(
      verifiedMatch
        ? "An alumni account with these SSC details already exists. Sign in with that account, or link Google from settings after you are verified."
        : "These SSC details are already under review for another account. Contact the alumni office if this is a mistake.",
      SSC_TAKEN_FIELD_ERRORS,
    );
  }

  const passwordHash = await hash(password, 12);

  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: "PENDING",
        },
        select: { id: true },
      });

      await createProfileWithUniqueSlug(tx, {
        userId: user.id,
        displayName: fullName,
        graduationYear: passingYear,
        gender,
      });

      await tx.verificationRequest.create({
        data: {
          userId: user.id,
          sscRoll,
          sscRegistration,
          passingYear,
          fullNameOnCert: fullName,
          status: "PENDING",
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      if (uniqueViolationMatches(error, ["email"])) {
        return actionError("An account with this email already exists.", {
          email: ["An account with this email already exists."],
        });
      }
      return actionError(
        "These SSC details are already registered or under review for another account.",
        SSC_TAKEN_FIELD_ERRORS,
      );
    }
    throw error;
  }

  await signIn("credentials", { email, password, redirect: false });

  // Non-blocking: ownership can be confirmed later via "Verify now".
  const { token, tokenHash } = createToken();
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token: tokenHash,
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });
  await sendEmailVerification(
    email,
    `${clientEnv.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(email)}`,
  );

  return actionOk(undefined, "Account created. Your verification request is with our team.");
}

export async function loginAction(formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    // No usable address to attribute the attempt to, so nothing is recorded. A malformed
    // submission never reached credential verification.
    return fromZodError(parsed.error);
  }

  const { email, password } = parsed.data;
  const context = await getRequestContext();

  const limit = await consumeRateLimit({ bucket: `login:${email}`, ...RATE_LIMITS.login });
  if (!limit.ok) {
    // Recorded because a burst of these is the signal that matters for credential stuffing.
    await tryWriteAuthAuditLog({
      action: AUTH_AUDIT_ACTIONS.loginFailed,
      provider: AUTH_PROVIDERS.credentials,
      subjectEmail: email,
      reason: AUDIT_REASONS.rateLimited,
      ...context,
    });

    return actionError(
      `Too many sign-in attempts. Try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  try {
    // redirect: false keeps this a plain action result; Auth.js would otherwise throw a
    // redirect error that the form cannot turn into a field message.
    await signIn("credentials", { email, password, redirect: false });
    return actionOk();
  } catch (error) {
    if (error instanceof AuthError) {
      // The audit row stores only an HMAC of the address, so recording the attempt does not
      // build a list of which accounts exist — and the reply to the browser stays identical
      // for unknown email and wrong password.
      await tryWriteAuthAuditLog({
        action: AUTH_AUDIT_ACTIONS.loginFailed,
        provider: AUTH_PROVIDERS.credentials,
        subjectEmail: email,
        reason: AUDIT_REASONS.invalidCredentials,
        ...context,
      });

      // Same message for unknown email and wrong password so the form is not an oracle
      // for which accounts exist.
      return actionError("Email or password is incorrect.");
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  // The LOGOUT audit row and the AuthSession transition are written by the `signOut` event in
  // src/auth.ts, which every sign-out path funnels through.
  // redirect:false so Set-Cookie clearing is not dropped by a NEXT_REDIRECT race.
  await signOut({ redirect: false });
  redirect("/");
}

/**
 * Always reports success. Telling the caller whether an address is registered would turn
 * this form into an account enumeration endpoint.
 */
export async function forgotPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { email } = parsed.data;

  const limit = await consumeRateLimit({
    bucket: `password-reset:${email}`,
    ...RATE_LIMITS.passwordReset,
  });

  if (limit.ok) {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, passwordHash: true, deletedAt: true },
    });

    // Accounts created through Google have no password to reset.
    if (user && user.passwordHash && !user.deletedAt) {
      const { token, tokenHash } = createToken();

      await prisma.$transaction([
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        }),
        prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
          },
        }),
      ]);

      await sendPasswordReset(
        email,
        `${clientEnv.NEXT_PUBLIC_APP_URL}/reset-password?token=${token}`,
      );
    }
  }

  return actionOk(
    undefined,
    "If that email is registered, a reset link is on its way. Check your inbox.",
  );
}

export async function resetPasswordAction(formData: FormData): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { token, password } = parsed.data;

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: { id: true, userId: true, expiresAt: true, usedAt: true },
  });

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return actionError("This reset link has expired or has already been used.");
  }

  const passwordHash = await hash(password, 12);
  const context = await getRequestContext();

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash } });
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });
    // Any other outstanding link for this account is now void.
    await tx.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    // A reset is the remedy for a compromised password, so it has to end sessions someone else
    // may already be holding. Same transaction as the password change: a reset that appears to
    // succeed while leaving a hijacked session alive is worse than one that fails outright.
    await revokeUserSessions(tx, {
      userId: record.userId,
      reason: AUDIT_REASONS.passwordReset,
      context,
    });
  });

  return actionOk(undefined, "Password updated. You can sign in now.");
}

/** Sends (or resends) an email confirmation link. Does not block app use. */
export async function requestEmailVerificationAction(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return actionError("Please sign in again.");
  if (viewer.emailVerified) return actionOk(undefined, "Your email is already verified.");

  const limit = await consumeRateLimit({
    bucket: `email-verify:${viewer.id}`,
    ...RATE_LIMITS.passwordReset,
  });
  if (!limit.ok) {
    return actionError(
      `Too many attempts. Try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  await prisma.verificationToken.deleteMany({ where: { identifier: viewer.email } });

  const { token, tokenHash } = createToken();
  await prisma.verificationToken.create({
    data: {
      identifier: viewer.email,
      token: tokenHash,
      expires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    },
  });

  await sendEmailVerification(
    viewer.email,
    `${clientEnv.NEXT_PUBLIC_APP_URL}/verify-email?token=${token}&email=${encodeURIComponent(viewer.email)}`,
  );

  return actionOk(undefined, "Check your inbox for a confirmation link.");
}
