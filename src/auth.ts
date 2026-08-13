import { compare } from "bcryptjs";
import NextAuth, { type User } from "next-auth";
import type { AdapterUser } from "next-auth/adapters";
import type { JWT } from "next-auth/jwt";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { AUTH_PROVIDERS, type AuthProvider } from "@/lib/audit-events";
import {
  endSessionByLogout,
  startSession,
} from "@/lib/auth/session-lifecycle";
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

/**
 * Applies the claims carried by a fresh sign-in, resolving the "Link provider" merge flow.
 *
 * Extracted from the jwt callback so that callback has exactly one place where a session is
 * opened; previously each branch returned its own token and any new branch would silently skip
 * whatever the last one did.
 */
async function resolveSignInToken(
  token: JWT,
  user: User | AdapterUser,
): Promise<JWT | null> {
  const userId = user.id;
  if (!userId) return null;

  token.sub = userId;
  if (user.role) token.role = user.role;
  if (user.status) token.status = user.status;
  if (user.name !== undefined) token.name = user.name;
  if (user.image !== undefined) token.picture = user.image;
  token.isEmailVerified = Boolean("emailVerified" in user ? user.emailVerified : false);
  token.profileComplete = Boolean(user.profileComplete);

  const linkTargetId = await consumeOAuthLinkIntent();
  if (linkTargetId && linkTargetId !== userId) {
    const target = await prisma.user.findUnique({
      where: { id: linkTargetId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (target && !target.deletedAt && target.status === "VERIFIED") {
      try {
        await mergeOAuthStubIntoUser(userId, linkTargetId);
        return applyUserClaims(token, linkTargetId);
      } catch (error) {
        if (!(error instanceof OAuthLinkConflictError)) throw error;

        await setOAuthLinkError(
          "This Google account is already linked to another alumni profile. Unlink it there first, or use a different Google account.",
        );

        // Restore the verified session that started Link Google. Drop an OAuth stub
        // created for this attempt so it does not linger as a second User.
        const incoming = await prisma.user.findUnique({
          where: { id: userId },
          select: { status: true },
        });
        if (incoming?.status === "UNVERIFIED") {
          await deleteOAuthStubUser(userId);
        }

        return applyUserClaims(token, linkTargetId);
      }
    }
  }

  if (!token.role || !token.status) {
    return applyUserClaims(token, userId);
  }

  token.refreshedAt = Date.now();
  return token;
}

function toAuthProvider(provider: string | undefined): AuthProvider {
  switch (provider) {
    case "google":
      return AUTH_PROVIDERS.google;
    case "facebook":
      return AUTH_PROVIDERS.facebook;
    default:
      return AUTH_PROVIDERS.credentials;
  }
}

/**
 * Opens an AuthSession row for a token that has just been issued and records LOGIN_SUCCESS.
 *
 * If this fails the sign-in fails with it. A token without a `sessionId` claim is rejected by the
 * DAL, so issuing one would hand the user a cookie that cannot authenticate anything — better to
 * surface the error at the login form.
 */
async function attachSession(token: JWT, provider: string | undefined): Promise<JWT> {
  if (!token.sub) return token;

  const authProvider = toAuthProvider(provider);
  token.sessionId = await startSession({
    userId: token.sub,
    provider: authProvider,
  });
  token.authProvider = authProvider;
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
    async jwt({ token, user, trigger, account }) {
      if (user?.id) {
        const signedIn = await resolveSignInToken(token, user);
        if (!signedIn) return null;

        // Session creation happens after the OAuth link/merge branches above have settled, so
        // the AuthSession belongs to the account the user actually ends up signed in as — not
        // to the throwaway stub Auth.js created for the provider callback.
        return attachSession(signedIn, account?.provider);
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
    /**
     * The single convergence point for every sign-out path: the server action, the client
     * `next-auth/react` call in the user menu, and any Auth.js-internal sign-out. Instrumenting
     * the individual call sites instead would guarantee one of them eventually drifts.
     *
     * Auth.js clears the cookie regardless of what happens here, which is the behaviour we want:
     * a database outage must not be able to keep someone signed in.
     */
    async signOut(message) {
      const sessionId =
        "token" in message && message.token && typeof message.token === "object"
          ? message.token.sessionId
          : undefined;
      if (!sessionId) return;

      try {
        await endSessionByLogout(sessionId);
      } catch (error) {
        console.error(`[auth] could not close session ${sessionId}:`, error);
      }
    },
  },
});
