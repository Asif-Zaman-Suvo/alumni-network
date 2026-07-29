import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { createAlumniAuthAdapter } from "@/lib/auth-adapter";
import {
  consumeOAuthLinkIntent,
  deleteOAuthStubUser,
  mergeOAuthStubIntoUser,
  OAuthLinkConflictError,
  setOAuthLinkError,
} from "@/lib/oauth-link";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

/**
 * Full Auth.js instance: adapter, credentials verification and the DB-backed JWT callback.
 *
 * OAuth return visits resolve via `Account(provider, providerAccountId)`.
 * First-time OAuth creates a stub User; SSC onboarding blocks if that SSC is already
 * VERIFIED (no auto-merge). Settings "Link provider" sets a short-lived cookie so the
 * stub created by Auth.js is merged into the already-verified session user instead.
 */

const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

const userClaimsSelect = {
  role: true,
  status: true,
  emailVerified: true,
  profileComplete: true,
  deletedAt: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} as const;

async function applyUserClaims(token: JWT, userId: string): Promise<JWT | null> {
  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: userClaimsSelect,
  });
  if (!fresh || fresh.deletedAt) return null;

  token.sub = userId;
  token.role = fresh.role;
  token.status = fresh.status;
  token.isEmailVerified = Boolean(fresh.emailVerified);
  token.profileComplete = fresh.profileComplete;
  token.name = fresh.profile?.displayName ?? token.name;
  token.picture = fresh.profile?.avatarUrl ?? token.picture;
  token.refreshedAt = Date.now();
  return token;
}

export const { handlers, auth, signIn, signOut, unstable_update } = NextAuth({
  ...authConfig,
  adapter: createAlumniAuthAdapter(),
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: {
            id: true,
            email: true,
            passwordHash: true,
            role: true,
            status: true,
            emailVerified: true,
            profileComplete: true,
            deletedAt: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        });

        if (!user || !user.passwordHash || user.deletedAt) return null;

        const valid = await compare(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.profile?.displayName ?? null,
          image: user.profile?.avatarUrl ?? null,
          role: user.role,
          status: user.status,
          emailVerified: user.emailVerified,
          profileComplete: user.profileComplete,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger, session }) {
      if (trigger === "update" && session && typeof session === "object") {
        const switchTo =
          "switchToUserId" in session && typeof session.switchToUserId === "string"
            ? session.switchToUserId
            : null;
        if (switchTo) {
          return applyUserClaims(token, switchTo);
        }
      }

      if (user?.id) {
        token.sub = user.id;
        if (user.role) token.role = user.role;
        if (user.status) token.status = user.status;
        if (user.name !== undefined) token.name = user.name;
        if (user.image !== undefined) token.picture = user.image;
        token.isEmailVerified = Boolean(
          "emailVerified" in user ? user.emailVerified : false,
        );
        token.profileComplete = Boolean(user.profileComplete);

        const linkTargetId = await consumeOAuthLinkIntent();
        if (linkTargetId && linkTargetId !== user.id) {
          const target = await prisma.user.findUnique({
            where: { id: linkTargetId },
            select: { id: true, status: true, deletedAt: true },
          });

          if (target && !target.deletedAt && target.status === "VERIFIED") {
            try {
              await mergeOAuthStubIntoUser(user.id, linkTargetId);
              return applyUserClaims(token, linkTargetId);
            } catch (error) {
              if (!(error instanceof OAuthLinkConflictError)) throw error;

              await setOAuthLinkError(
                "This Google account is already linked to another alumni profile. Unlink it there first, or use a different Google account.",
              );

              // Restore the verified session that started Link Google. Drop an OAuth stub
              // created for this attempt so it does not linger as a second User.
              const incoming = await prisma.user.findUnique({
                where: { id: user.id },
                select: { status: true },
              });
              if (incoming?.status === "UNVERIFIED") {
                await deleteOAuthStubUser(user.id);
              }

              return applyUserClaims(token, linkTargetId);
            }
          }
        }

        if (!token.role || !token.status) {
          return applyUserClaims(token, user.id);
        }

        token.refreshedAt = Date.now();
        return token;
      }

      const stale = Date.now() - (token.refreshedAt ?? 0) > TOKEN_REFRESH_INTERVAL_MS;
      if ((trigger === "update" || stale) && token.sub) {
        return applyUserClaims(token, token.sub);
      }

      return token;
    },
  },
  events: {
    async linkAccount({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },
});
