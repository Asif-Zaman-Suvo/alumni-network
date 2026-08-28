import { PrismaAdapter } from "@auth/prisma-adapter";
import type { Role, UserStatus } from "@prisma/client";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { prisma } from "@/lib/prisma";
import { createProfileWithUniqueSlug } from "@/lib/unique-slug";

type AlumniAdapterUser = AdapterUser & {
  role: Role;
  status: UserStatus;
  profileComplete: boolean;
};

/**
 * Auth.js's default Prisma adapter expects `User.name` and `User.image`.
 * This schema keeps display name / avatar on `Profile`, so we adapt the create/read
 * paths and never pass `name`/`image` into `prisma.user.create`.
 */
export function createAlumniAuthAdapter(): Adapter {
  const base = PrismaAdapter(prisma);

  return {
    ...base,
    async createUser(data) {
      const { name, image, email, emailVerified } = data;

      const user = await prisma.user.create({
        data: {
          email,
          emailVerified: emailVerified ?? null,
          status: "UNVERIFIED",
        },
        select: {
          id: true,
          email: true,
          emailVerified: true,
          role: true,
          status: true,
          profileComplete: true,
        },
      });

      // Best-effort profile so JWT can show a name/avatar before onboarding finishes.
      if (name || image) {
        const displayName = name?.trim() || email.split("@")[0] || "Alumni";
        await createProfileWithUniqueSlug(prisma, {
          userId: user.id,
          displayName,
          avatarUrl: image ?? null,
        });
      }

      return toAdapterUser(user, name ?? null, image ?? null);
    },

    async getUser(id) {
      const user = await prisma.user.findUnique({
        where: { id },
        select: { ...userWithProfileSelect, deletedAt: true },
      });
      if (!user || user.deletedAt) return null;
      return toAdapterUserFromRow(user);
    },

    async getUserByEmail(email) {
      const user = await prisma.user.findFirst({
        where: { email, deletedAt: null },
        select: userWithProfileSelect,
      });
      return user ? toAdapterUserFromRow(user) : null;
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await prisma.account.findUnique({
        where: {
          provider_providerAccountId: { provider, providerAccountId },
        },
        select: {
          user: { select: { ...userWithProfileSelect, deletedAt: true } },
        },
      });
      if (!account?.user || account.user.deletedAt) return null;
      return toAdapterUserFromRow(account.user);
    },

    async updateUser(data) {
      const { id, name, image, email, emailVerified } = data;

      await prisma.user.update({
        where: { id },
        data: {
          ...(email !== undefined ? { email } : {}),
          ...(emailVerified !== undefined ? { emailVerified } : {}),
        },
      });

      if (name !== undefined || image !== undefined) {
        const existing = await prisma.profile.findUnique({
          where: { userId: id },
          select: { displayName: true },
        });

        if (existing) {
          await prisma.profile.update({
            where: { userId: id },
            data: {
              ...(name !== undefined && name ? { displayName: name } : {}),
              ...(image !== undefined ? { avatarUrl: image } : {}),
            },
          });
        } else if (name || image) {
          const row = await prisma.user.findUniqueOrThrow({
            where: { id },
            select: { email: true },
          });
          const displayName = name?.trim() || row.email.split("@")[0] || "Alumni";
          await createProfileWithUniqueSlug(prisma, {
            userId: id,
            displayName,
            avatarUrl: image ?? null,
          });
        }
      }

      const refreshed = await prisma.user.findUniqueOrThrow({
        where: { id },
        select: userWithProfileSelect,
      });
      return toAdapterUserFromRow(refreshed);
    },
  };
}

const userWithProfileSelect = {
  id: true,
  email: true,
  emailVerified: true,
  role: true,
  status: true,
  profileComplete: true,
  profile: { select: { displayName: true, avatarUrl: true } },
} as const;

type UserRow = {
  id: string;
  email: string;
  emailVerified: Date | null;
  role: Role;
  status: UserStatus;
  profileComplete: boolean;
  profile: { displayName: string; avatarUrl: string | null } | null;
};

function toAdapterUserFromRow(user: UserRow): AlumniAdapterUser {
  return toAdapterUser(
    user,
    user.profile?.displayName ?? null,
    user.profile?.avatarUrl ?? null,
  );
}

function toAdapterUser(
  user: {
    id: string;
    email: string;
    emailVerified: Date | null;
    role: Role;
    status: UserStatus;
    profileComplete: boolean;
  },
  name: string | null,
  image: string | null,
): AlumniAdapterUser {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    name,
    image,
    role: user.role,
    status: user.status,
    profileComplete: user.profileComplete,
  };
}
