import { slugify } from "@/lib/utils";

type ProfileCreateClient = {
  profile: {
    create(args: {
      data: {
        userId: string;
        slug: string;
        displayName: string;
        avatarUrl?: string | null;
        graduationYear?: number | null;
        gender?: "MALE" | "FEMALE";
      };
    }): Promise<unknown>;
    findMany(args: {
      where: { slug: { startsWith: string } };
      select: { slug: true };
    }): Promise<{ slug: string }[]>;
  };
};

/** Short random tail, used once the readable numbered suffixes are exhausted. */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * Inserts a profile under a slug that no other profile is using.
 *
 * The free slug is found by reading first, not by inserting and catching the unique violation.
 * Every caller runs this inside a transaction, and Postgres aborts the entire transaction on the
 * first failed statement — so a retry loop around `create` cannot recover: the collision aborts
 * the transaction and each following attempt fails with "current transaction is aborted"
 * regardless of which slug it tries. Two alumni sharing a display name is ordinary here, so that
 * path turned a duplicate name into a failed signup.
 *
 * Relies on Profile.slug being UNIQUE in the database.
 */
export async function createProfileWithUniqueSlug(
  client: ProfileCreateClient,
  data: {
    userId: string;
    displayName: string;
    avatarUrl?: string | null;
    graduationYear?: number | null;
    gender?: "MALE" | "FEMALE";
  },
): Promise<void> {
  const base = slugify(data.displayName) || "alum";

  const taken = new Set(
    (
      await client.profile.findMany({
        where: { slug: { startsWith: base } },
        select: { slug: true },
      })
    ).map((row) => row.slug),
  );

  let slug = base;
  for (let attempt = 2; taken.has(slug); attempt += 1) {
    // Numbered while they stay readable, then random so that two signups racing on the same name
    // cannot keep landing on the same next number.
    slug = attempt <= 25 ? `${base}-${attempt}` : `${base}-${randomSuffix()}`;
  }

  await client.profile.create({
    data: {
      userId: data.userId,
      slug,
      displayName: data.displayName,
      ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
      ...(data.graduationYear !== undefined
        ? { graduationYear: data.graduationYear }
        : {}),
      ...(data.gender !== undefined ? { gender: data.gender } : {}),
    },
  });
}
