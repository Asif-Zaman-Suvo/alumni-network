"use server";

import { hash } from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { clientEnv } from "@/env";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
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
import { slugify } from "@/lib/utils";
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@/lib/validation";

/**
 * Registration creates the account AND the first verification request in one transaction.
 * A user is never left in a state where they have signed up but the admin has nothing to
 * review, which is the failure mode that generates support requests.
 */
export async function registerAction(formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password, fullName, sscRoll, sscRegistration, passingYear } = parsed.data;

  const limit = await consumeRateLimit({
    bucket: `register:${email}`,
    ...RATE_LIMITS.register,
  });
  if (!limit.ok) {
    return actionError(
      `Too many attempts. Try again in ${formatRetryAfter(limit.retryAfterSeconds)}.`,
    );
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return actionError("An account with this email already exists.", {
      email: ["An account with this email already exists."],
    });
  }

  // Alumni identity is SSC roll + registration, not email. Block a second claim when the
  // identity is already verified or already waiting in the admin queue under another user.
  const sscTaken = await prisma.verificationRequest.findFirst({
    where: {
      sscRoll,
      sscRegistration,
      status: { in: ["VERIFIED", "PENDING"] },
      user: { deletedAt: null },
    },
    select: { id: true, status: true },
  });
  if (sscTaken) {
    return actionError(
      sscTaken.status === "VERIFIED"
        ? "An alumni account with these SSC details already exists. Sign in with that account, or link Google from settings after you are verified."
        : "These SSC details are already under review for another account. Contact the alumni office if this is a mistake.",
      {
        sscRoll: ["These SSC details are already registered."],
        sscRegistration: ["These SSC details are already registered."],
      },
    );
  }

  const passwordHash = await hash(password, 12);
  const slug = await uniqueSlug(fullName);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        passwordHash,
        status: "PENDING",
        profile: {
          create: {
            slug,
            displayName: fullName,
            graduationYear: passingYear,
          },
        },
      },
      select: { id: true },
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
  if (!parsed.success) return fromZodError(parsed.error);

  const { email, password } = parsed.data;

  const limit = await consumeRateLimit({ bucket: `login:${email}`, ...RATE_LIMITS.login });
  if (!limit.ok) {
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
      // Same message for unknown email and wrong password so the form is not an oracle
      // for which accounts exist.
      return actionError("Email or password is incorrect.");
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
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

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    }),
    // Any other outstanding link for this account is now void.
    prisma.passwordResetToken.updateMany({
      where: { userId: record.userId, usedAt: null },
      data: { usedAt: new Date() },
    }),
  ]);

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

/** Profile slugs are user-visible URLs, so collisions are resolved with a numeric suffix. */
async function uniqueSlug(displayName: string): Promise<string> {
  const base = slugify(displayName) || "alum";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const taken = await prisma.profile.findUnique({
      where: { slug: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }

  return `${base}-${Date.now().toString(36)}`;
}
