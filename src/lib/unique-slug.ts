import { slugify } from "@/lib/utils";
import { isUniqueViolation } from "@/lib/prisma-errors";

type ProfileCreateClient = {
  profile: {
    create(args: {
      data: {
        userId: string;
        slug: string;
        displayName: string;
        avatarUrl?: string | null;
        graduationYear?: number | null;
      };
    }): Promise<unknown>;
  };
};

/**
 * Inserts a profile, retrying on slug collisions (TOCTOU-safe under concurrent signups).
 * Relies on Profile.slug being UNIQUE in the database.
 */
export async function createProfileWithUniqueSlug(
  client: ProfileCreateClient,
  data: {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    graduationYear?: number | null;
  },
): Promise<void> {
  const base = slugify(data.displayName) || "alum";

  for (let attempt = 0; attempt < 25; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      await client.profile.create({
        data: {
          userId: data.userId,
          slug,
          displayName: data.displayName,
          ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
          ...(data.graduationYear !== undefined
            ? { graduationYear: data.graduationYear }
            : {}),
        },
      });
      return;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }

  await client.profile.create({
    data: {
      userId: data.userId,
      slug: `${base}-${Date.now().toString(36)}`,
      displayName: data.displayName,
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.graduationYear !== undefined
        ? { graduationYear: data.graduationYear }
        : {}),
    },
  });
}
