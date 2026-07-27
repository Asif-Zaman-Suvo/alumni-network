import { PrismaAdapter } from "@auth/prisma-adapter";
import { compare } from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";

/**
 * Full Auth.js instance: adapter, credentials verification and the DB-backed JWT callback.
 * Server components, route handlers and Server Actions import from here.
 */

/**
 * Role/status live in the JWT. We deliberately do NOT re-query Postgres on every RSC
 * navigation: each remote round-trip is ~1–3s from this deployment region, and Auth.js
 * often fails to persist `refreshedAt` from Server Components — which made the old 5-minute
 * refresh fire on every request (≈3s auth tax on top of page queries).
 *
 * Refresh sources:
 *   - Sign-in (`user` present): claims copied from authorize() — zero extra DB hit
 *   - `trigger === "update"`: explicit session.update()
 *   - Hourly safety net: picks up role/suspension changes without a re-login
 */
const TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000;

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
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
            deletedAt: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        });

        // Users created through Google have no passwordHash; fall through to the same
        // generic failure so the response never reveals which accounts exist.
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
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async jwt({ token, user, trigger }) {
      if (user?.id) {
        token.sub = user.id;
        if (user.role) token.role = user.role;
        if (user.status) token.status = user.status;
        if (user.name !== undefined) token.name = user.name;
        if (user.image !== undefined) token.picture = user.image;

        // OAuth first login may omit role/status on the user object — one DB read then.
        if (!token.role || !token.status) {
          const fresh = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
              role: true,
              status: true,
              deletedAt: true,
              profile: { select: { displayName: true, avatarUrl: true } },
            },
          });
          if (!fresh || fresh.deletedAt) return null;
          token.role = fresh.role;
          token.status = fresh.status;
          token.name = fresh.profile?.displayName ?? token.name;
          token.picture = fresh.profile?.avatarUrl ?? token.picture;
        }

        token.refreshedAt = Date.now();
        return token;
      }

      const stale = Date.now() - (token.refreshedAt ?? 0) > TOKEN_REFRESH_INTERVAL_MS;
      if ((trigger === "update" || stale) && token.sub) {
        const fresh = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            role: true,
            status: true,
            deletedAt: true,
            profile: { select: { displayName: true, avatarUrl: true } },
          },
        });

        // Deleting an account invalidates the session on the next refresh window.
        if (!fresh || fresh.deletedAt) return null;

        token.role = fresh.role;
        token.status = fresh.status;
        token.name = fresh.profile?.displayName ?? token.name;
        token.picture = fresh.profile?.avatarUrl ?? token.picture;
        token.refreshedAt = Date.now();
      }

      return token;
    },
  },
  events: {
    /**
     * A brand new Google user has no SSC details yet, so they land in UNVERIFIED and the
     * proxy sends them to /onboarding. The adapter creates the row without a status, so
     * the default from the schema applies; nothing to do here beyond recording the email
     * as verified, which Google has already proven.
     */
    async linkAccount({ user }) {
      if (!user.id) return;
      await prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
    },
  },
});
