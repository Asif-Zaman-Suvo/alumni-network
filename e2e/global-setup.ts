import { PrismaClient } from "@prisma/client";

/*
 * Sign-in throttling is persisted in Postgres and keyed by email, so the handful of seeded accounts
 * that every spec signs in with accumulate hits across runs and eventually lock the whole suite out
 * of logging in. Clearing their buckets keeps runs independent without relaxing the limit the
 * application actually enforces. Scoped to the `.test` domain the seed uses so no real account's
 * throttle state is touched.
 */
export default async function globalSetup() {
  const prisma = new PrismaClient();

  try {
    await prisma.rateLimitHit.deleteMany({
      where: { bucket: { endsWith: ".test" } },
    });
  } finally {
    await prisma.$disconnect();
  }
}
