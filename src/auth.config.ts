import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import { serverEnv } from "@/env";

export const isGoogleEnabled = Boolean(
  serverEnv.AUTH_GOOGLE_ID && serverEnv.AUTH_GOOGLE_SECRET,
);

/**
 * Database-free half of the Auth.js configuration.
 *
 * Next 16 runs `proxy.ts` on the Node runtime, so Prisma would technically work there.
 * The split is kept anyway for a different reason: request interception runs on every
 * navigation, and it should decode the JWT rather than open a database connection. Only
 * `auth.ts` pulls in the adapter, bcrypt and Prisma.
 */
export const authConfig = {
  providers: isGoogleEnabled
    ? [
        Google({
          clientId: serverEnv.AUTH_GOOGLE_ID,
          clientSecret: serverEnv.AUTH_GOOGLE_SECRET,
          allowDangerousEmailAccountLinking: true,
        }),
      ]
    : [],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    // Credentials providers cannot use database sessions in Auth.js v5.
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  callbacks: {
    /**
     * Pure token to session mapping. Must stay DB-free so the proxy can call `auth()`
     * without touching Postgres.
     */
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = token.role;
      session.user.status = token.status;
      session.user.isEmailVerified = Boolean(token.isEmailVerified);
      session.user.profileComplete = Boolean(token.profileComplete);
      return session;
    },
  },
  trustHost: true,
} satisfies NextAuthConfig;
