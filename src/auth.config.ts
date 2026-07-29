import type { NextAuthConfig } from "next-auth";
import Facebook from "next-auth/providers/facebook";
import Google from "next-auth/providers/google";
import { serverEnv } from "@/env";

export const isGoogleEnabled = Boolean(
  serverEnv.AUTH_GOOGLE_ID && serverEnv.AUTH_GOOGLE_SECRET,
);

export const isFacebookEnabled = Boolean(
  serverEnv.AUTH_FACEBOOK_ID && serverEnv.AUTH_FACEBOOK_SECRET,
);

/**
 * Database-free half of the Auth.js configuration.
 *
 * Alumni identity is SSC roll + registration on `VerificationRequest`, not OAuth email.
 * Google may auto-link when the mailbox matches an existing User.email (same person owns
 * that Gmail). Facebook stays unlinked-by-email — profiles often omit email and we use a
 * synthetic address; attach Facebook only via settings while signed in.
 *
 * Next 16 runs `proxy.ts` on the Node runtime, so Prisma would technically work there.
 * The split is kept anyway: request interception should decode the JWT rather than open
 * a database connection. Only `auth.ts` pulls in the adapter, bcrypt and Prisma.
 */
export const authConfig = {
  providers: [
    ...(isGoogleEnabled
      ? [
          Google({
            clientId: serverEnv.AUTH_GOOGLE_ID!,
            clientSecret: serverEnv.AUTH_GOOGLE_SECRET!,
            // Same Gmail as a password signup → attach Google to that User row.
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(isFacebookEnabled
      ? [
          Facebook({
            clientId: serverEnv.AUTH_FACEBOOK_ID!,
            clientSecret: serverEnv.AUTH_FACEBOOK_SECRET!,
            allowDangerousEmailAccountLinking: false,
            /**
             * Facebook often omits email. `User.email` is still UNIQUE and required by the
             * adapter, so we store a stable synthetic address keyed by Facebook user id.
             * That string is never treated as proof of alumni identity.
             */
            profile(profile) {
              const id = String(profile.id);
              return {
                id,
                name: profile.name ?? null,
                email:
                  typeof profile.email === "string" && profile.email.length > 0
                    ? profile.email
                    : `fb_${id}@users.noreply.local`,
                image:
                  profile.picture &&
                  typeof profile.picture === "object" &&
                  "data" in profile.picture &&
                  profile.picture.data &&
                  typeof profile.picture.data === "object" &&
                  "url" in profile.picture.data
                    ? String(profile.picture.data.url)
                    : null,
              };
            },
          }),
        ]
      : []),
  ],
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
