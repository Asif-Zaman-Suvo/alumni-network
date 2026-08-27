/**
 * Production/demo seed: SSC departments + one administrator.
 * Does not create fake alumni.
 *
 * Requires SEED_ADMIN_PASSWORD in the environment (never commit the value).
 * Run with: npm run db:seed
 */
import { config as loadEnv } from "dotenv";
import { hash } from "bcryptjs";
import { PrismaClient, Visibility } from "@prisma/client";

loadEnv({ path: [".env.local", ".env"] });

const prisma = new PrismaClient();

const ADMIN_EMAIL = "alumnishksc@gmail.com";
const DEPARTMENTS = ["Science", "Business Studies", "Humanities"] as const;

async function seedDepartments() {
  await Promise.all(
    DEPARTMENTS.map((name, index) =>
      prisma.department.upsert({
        where: { name },
        update: { sortkey: index },
        create: {
          name,
          slug: name.toLowerCase().replace(/\s+/g, "-"),
          sortkey: index,
        },
      }),
    ),
  );

  const retired = await prisma.department.findMany({
    where: { name: { notIn: [...DEPARTMENTS] } },
    select: { id: true },
  });
  if (retired.length > 0) {
    const ids = retired.map((row) => row.id);
    await prisma.profile.updateMany({
      where: { departmentId: { in: ids } },
      data: { departmentId: null },
    });
    await prisma.department.deleteMany({ where: { id: { in: ids } } });
  }

  return prisma.department.findMany({ orderBy: { sortkey: "asc" } });
}

async function seedAdmin(passwordHash: string) {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      passwordHash,
      role: "ADMIN",
      status: "VERIFIED",
      profileComplete: true,
      emailVerified: new Date(),
      deletedAt: null,
    },
    create: {
      email: ADMIN_EMAIL,
      passwordHash,
      role: "ADMIN",
      status: "VERIFIED",
      emailVerified: new Date(),
      profileComplete: true,
      profile: {
        create: {
          slug: "alumni-office",
          displayName: "Alumni Office",
          headline: "SHKSC Alumni Network administrator",
          visibility: Visibility.PRIVATE,
          whatsappPhone: "+8801700000000",
        },
      },
    },
  });

  await prisma.user.update({
    where: { id: admin.id },
    data: { profileComplete: true, role: "ADMIN", status: "VERIFIED", deletedAt: null },
  });

  return admin;
}

async function main() {
  const password = process.env.SEED_ADMIN_PASSWORD?.trim();
  if (!password) {
    throw new Error("Set SEED_ADMIN_PASSWORD before running the seed.");
  }

  console.log("Seeding departments and admin...");

  const passwordHash = await hash(password, 12);
  const departments = await seedDepartments();
  console.log(`  ${departments.length} departments`);

  const admin = await seedAdmin(passwordHash);
  console.log(`  admin ${admin.email}`);

  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
