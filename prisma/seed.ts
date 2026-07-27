/**
 * Seeds departments plus enough synthetic data that the directory and the admin review
 * queue are both developed against realistic volume rather than three happy-path rows.
 *
 * Run with: npm run db:seed
 */
import { PrismaClient, Visibility, type Prisma } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

const DEPARTMENTS = [
  "Science",
  "Business Studies",
  "Humanities",
  "Vocational",
] as const;

const FIRST_NAMES = [
  "Ayesha", "Rafi", "Nusrat", "Tanvir", "Sadia", "Imran", "Farhana", "Mahmud",
  "Sumaiya", "Arif", "Nabila", "Shakib", "Tasnim", "Rezwan", "Mitu", "Jubayer",
  "Lamia", "Sabbir", "Rumana", "Asif", "Ishrat", "Naeem", "Fahmida", "Rakib",
  "Anika", "Shahriar", "Maliha", "Tahsin", "Sanjida", "Mizanur",
];

const LAST_NAMES = [
  "Rahman", "Islam", "Hossain", "Ahmed", "Chowdhury", "Karim", "Akter", "Uddin",
  "Bhuiyan", "Sarker", "Mia", "Khan", "Haque", "Talukder", "Molla", "Siddique",
];

const COMPANIES = [
  "bKash", "Grameenphone", "BRAC", "Pathao", "Shohoz", "Therap BD", "Samsung R&D",
  "Robi Axiata", "Sheba.xyz", "Chaldal", "Optimizely", "Cefalo", "Nagad", "Enosis",
  "Standard Chartered", "Unilever Bangladesh", "Square Pharmaceuticals",
];

const POSITIONS = [
  "Software Engineer", "Product Manager", "Data Analyst", "Doctor", "Lecturer",
  "Civil Engineer", "Accountant", "Architect", "Lawyer", "Marketing Lead",
  "Research Associate", "Operations Manager", "UX Designer", "Banker",
];

const DEGREES = ["BSc", "BBA", "BA", "MBBS", "BArch", "LLB", "MSc", "MBA"];

const CITIES: Array<[string, string]> = [
  ["Dhaka", "BD"], ["Chattogram", "BD"], ["Sylhet", "BD"], ["Khulna", "BD"],
  ["Rajshahi", "BD"], ["London", "GB"], ["Toronto", "CA"], ["New York", "US"],
  ["Berlin", "DE"], ["Kuala Lumpur", "MY"], ["Sydney", "AU"], ["Dubai", "AE"],
  ["Tokyo", "JP"], ["Singapore", "SG"],
];

const VISIBILITIES: Visibility[] = [
  Visibility.PUBLIC,
  Visibility.MEMBERS_ONLY,
  Visibility.MEMBERS_ONLY,
  Visibility.MEMBERS_ONLY,
  Visibility.PRIVATE,
];

const VERIFIED_COUNT = 500;
const PENDING_COUNT = 40;
const REJECTED_COUNT = 8;
const EARLIEST_PASSING_YEAR = 1995;
const LATEST_PASSING_YEAR = 2024;

/** Deterministic PRNG so reseeding produces a comparable dataset. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
}

const random = createRandom(20260727);

function pick<T>(items: readonly T[]): T {
  const item = items[Math.floor(random() * items.length)];
  if (item === undefined) throw new Error("pick() called with an empty list");
  return item;
}

function maybe<T>(value: T, probability = 0.75): T | null {
  return random() < probability ? value : null;
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(random() * (max - min + 1));
}

function sscRoll(): string {
  return String(randomInt(100000, 999999));
}

function sscRegistration(): string {
  return String(randomInt(1000000000, 1999999999));
}

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

  return prisma.department.findMany({ orderBy: { sortkey: "asc" } });
}

async function seedAdmin(passwordHash: string) {
  const admin = await prisma.user.upsert({
    where: { email: "admin@school.test" },
    update: { role: "ADMIN", status: "VERIFIED" },
    create: {
      email: "admin@school.test",
      passwordHash,
      role: "ADMIN",
      status: "VERIFIED",
      emailVerified: new Date(),
      profile: {
        create: {
          slug: "school-admin",
          displayName: "School Admin",
          headline: "Alumni network administrator",
          visibility: Visibility.PRIVATE,
        },
      },
    },
  });

  console.log(`  admin: admin@school.test / password: password123`);
  return admin;
}

type SeedProfile = {
  email: string;
  displayName: string;
  slug: string;
  // Unchecked variant so departmentId can be set by id instead of a nested connect.
  data: Prisma.ProfileUncheckedCreateWithoutUserInput;
};

function buildProfile(index: number, departmentIds: string[]): SeedProfile {
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);
  const displayName = `${firstName} ${lastName}`;
  const [city, countryCode] = pick(CITIES);
  const passingYear = randomInt(EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR);
  const company = maybe(pick(COMPANIES), 0.8);
  const position = company ? pick(POSITIONS) : null;
  const slugBase = `${firstName}-${lastName}`.toLowerCase();

  return {
    email: `alumni${index}@example.test`,
    displayName,
    slug: `${slugBase}-${index}`,
    data: {
      slug: `${slugBase}-${index}`,
      displayName,
      headline: position && company ? `${position} at ${company}` : null,
      bio: maybe(
        `Passed SSC in ${passingYear}. Currently based in ${city}. Happy to help juniors with career questions.`,
        0.55,
      ),
      graduationYear: passingYear,
      degree: maybe(pick(DEGREES), 0.7),
      departmentId: maybe(pick(departmentIds), 0.9),
      company,
      position,
      linkedInUrl: maybe(`https://www.linkedin.com/in/${slugBase}-${index}`, 0.45),
      city,
      countryCode,
      visibility: pick(VISIBILITIES),
      showEmail: random() < 0.3,
      showEmployer: random() < 0.85,
    },
  };
}

async function seedVerifiedAlumni(passwordHash: string, departmentIds: string[], adminId: string) {
  for (let index = 0; index < VERIFIED_COUNT; index += 1) {
    const profile = buildProfile(index, departmentIds);
    const passingYear = profile.data.graduationYear ?? LATEST_PASSING_YEAR;

    await prisma.user.upsert({
      where: { email: profile.email },
      update: {},
      create: {
        email: profile.email,
        passwordHash,
        status: "VERIFIED",
        emailVerified: new Date(),
        profile: { create: profile.data },
        verifications: {
          create: {
            sscRoll: sscRoll(),
            sscRegistration: sscRegistration(),
            passingYear,
            fullNameOnCert: profile.displayName,
            status: "VERIFIED",
            reviewedById: adminId,
            reviewedAt: new Date(),
          },
        },
      },
    });
  }

  console.log(`  ${VERIFIED_COUNT} verified alumni`);
}

async function seedReviewQueue(passwordHash: string) {
  for (let index = 0; index < PENDING_COUNT; index += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);

    await prisma.user.upsert({
      where: { email: `pending${index}@example.test` },
      update: {},
      create: {
        email: `pending${index}@example.test`,
        passwordHash,
        status: "PENDING",
        emailVerified: new Date(),
        verifications: {
          create: {
            sscRoll: sscRoll(),
            sscRegistration: sscRegistration(),
            passingYear: randomInt(EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR),
            fullNameOnCert: `${firstName} ${lastName}`,
            // Roughly a third submit without evidence, which is what the admin has to chase.
            documentPath: maybe(`seed/pending-${index}.jpg`, 0.68),
            status: "PENDING",
            createdAt: new Date(Date.now() - randomInt(0, 21) * 86_400_000),
          },
        },
      },
    });
  }

  for (let index = 0; index < REJECTED_COUNT; index += 1) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);

    await prisma.user.upsert({
      where: { email: `rejected${index}@example.test` },
      update: {},
      create: {
        email: `rejected${index}@example.test`,
        passwordHash,
        status: "REJECTED",
        emailVerified: new Date(),
        verifications: {
          create: {
            sscRoll: sscRoll(),
            sscRegistration: sscRegistration(),
            passingYear: randomInt(EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR),
            fullNameOnCert: `${firstName} ${lastName}`,
            status: "REJECTED",
            reviewNote: "Roll number does not match our records for that year. Please re-check your marksheet.",
            reviewedAt: new Date(),
          },
        },
      },
    });
  }

  console.log(`  ${PENDING_COUNT} pending and ${REJECTED_COUNT} rejected requests`);
}

async function main() {
  console.log("Seeding...");

  const passwordHash = await hash("password123", 10);
  const departments = await seedDepartments();
  const departmentIds = departments.map((department) => department.id);
  console.log(`  ${departments.length} departments`);

  const admin = await seedAdmin(passwordHash);
  await seedVerifiedAlumni(passwordHash, departmentIds, admin.id);
  await seedReviewQueue(passwordHash);

  console.log("Done.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
