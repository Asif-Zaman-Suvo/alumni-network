import { unstable_cache } from "next/cache";
import { Prisma, prisma } from "@/lib/prisma";
import {
  canViewProfile,
  directoryVisibilityLevels,
} from "@/lib/dal/privacy";
import { getViewer, type Viewer } from "@/lib/dal/session";
import { EDUCATION_GROUPS } from "@/lib/education-groups";
import { consumeMemoryRateLimit } from "@/lib/memory-rate-limit";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { isBloodGroup, type BloodGroupValue } from "@/lib/blood-group";
import type { Gender, Visibility } from "@prisma/client";

/**
 * The only sanctioned read path for profile data.
 *
 * Two rules hold for every function here:
 *   1. The viewer is resolved from the session, never from an argument.
 *   2. Columns are listed explicitly. `email`, `passwordHash` and anything on
 *      VerificationRequest (SSC roll, registration, certificate path) are unreachable from
 *      this module by construction — those live in src/lib/dal/admin.ts.
 */

export type DirectoryEntry = {
  slug: string;
  displayName: string;
  headline: string | null;
  avatarUrl: string | null;
  graduationYear: number | null;
  departmentName: string | null;
  company: string | null;
  position: string | null;
  city: string | null;
  countryCode: string | null;
  gender: Gender | null;
  bloodGroup: BloodGroupValue | null;
};

export type DirectorySort = "relevance" | "name" | "recent" | "year";

export type DirectoryQuery = {
  q?: string;
  yearFrom?: number;
  yearTo?: number;
  departmentId?: string;
  countryCode?: string;
  bloodGroup?: BloodGroupValue;
  sort?: DirectorySort;
  page?: number;
  pageSize?: number;
};

export type DirectoryResult = {
  entries: DirectoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export const DEFAULT_PAGE_SIZE = 15;
const MAX_PAGE_SIZE = 60;

const EMPTY_RESULT: DirectoryResult = {
  entries: [],
  total: 0,
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
  totalPages: 0,
};

function visibilityFragment(levels: Visibility[]): Prisma.Sql {
  return Prisma.sql`p."visibility" IN (${Prisma.join(
    levels.map((level) => Prisma.sql`${level}::"Visibility"`),
  )})`;
}

function buildWhere(viewer: Viewer, query: DirectoryQuery): Prisma.Sql {
  const conditions: Prisma.Sql[] = [
    Prisma.sql`u."deletedAt" IS NULL`,
    Prisma.sql`u."status" = ${"VERIFIED"}::"UserStatus"`,
    visibilityFragment(directoryVisibilityLevels(viewer)),
  ];

  const term = query.q?.trim();
  if (term) {
    conditions.push(
      Prisma.sql`(
        p."searchVector" @@ plainto_tsquery('simple', ${term})
        OR p."displayName" % ${term}
      )`,
    );
  }

  if (query.yearFrom !== undefined) {
    conditions.push(Prisma.sql`p."graduationYear" >= ${query.yearFrom}`);
  }
  if (query.yearTo !== undefined) {
    conditions.push(Prisma.sql`p."graduationYear" <= ${query.yearTo}`);
  }
  if (query.departmentId) {
    conditions.push(Prisma.sql`p."departmentId" = ${query.departmentId}`);
  }
  if (query.countryCode) {
    conditions.push(Prisma.sql`p."countryCode" = ${query.countryCode}`);
  }
  if (query.bloodGroup) {
    conditions.push(Prisma.sql`p."bloodGroup" = ${query.bloodGroup}::"BloodGroup"`);
  }

  return Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}`;
}

function buildOrderBy(sort: DirectorySort, term: string | undefined): Prisma.Sql {
  if (sort === "relevance" && term) {
    // Full-text rank plus trigram similarity: the first orders prose matches, the second
    // keeps near-miss name spellings near the top.
    return Prisma.sql`ORDER BY (
      ts_rank(p."searchVector", plainto_tsquery('simple', ${term})) * 2
      + similarity(p."displayName", ${term})
    ) DESC, p."displayName" ASC`;
  }

  switch (sort) {
    case "recent":
      return Prisma.sql`ORDER BY p."createdAt" DESC, p."displayName" ASC`;
    case "year":
      return Prisma.sql`ORDER BY p."graduationYear" DESC NULLS LAST, p."displayName" ASC`;
    default:
      return Prisma.sql`ORDER BY p."displayName" ASC`;
  }
}

/**
 * Directory listing. Written as one raw query rather than a Prisma `findMany` because the
 * tsvector and trigram operators have no Prisma equivalent, and splitting ranking from
 * filtering would let the paginated page and the total count drift apart.
 *
 * Page rows and total use a single statement (`COUNT(*) OVER()`) so a remote pooler with
 * connection_limit=1 does not pay two serialized round-trips.
 */
export async function searchDirectory(query: DirectoryQuery): Promise<DirectoryResult> {
  const viewer = await getViewer();

  // Unverified or incomplete alumni get nothing from the list.
  if (!viewer?.isVerified) return EMPTY_RESULT;
  if (!viewer.isAdmin && !viewer.profileComplete) return EMPTY_RESULT;

  const page = Math.max(1, Math.floor(query.page ?? 1));
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(query.pageSize ?? DEFAULT_PAGE_SIZE)));
  const term = query.q?.trim() || undefined;

  // In-memory throttle: Postgres rate-limit was three ~1s round-trips per keystroke search.
  if (term) {
    const limit = consumeMemoryRateLimit({
      bucket: `search:${viewer.id}`,
      ...RATE_LIMITS.search,
    });
    if (!limit.ok) return EMPTY_RESULT;
  }

  const where = buildWhere(viewer, query);
  const orderBy = buildOrderBy(query.sort ?? (term ? "relevance" : "name"), term);
  const offset = (page - 1) * pageSize;

  type Row = DirectoryEntry & { total: number };

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      p."slug",
      p."displayName",
      p."headline",
      p."avatarUrl",
      p."graduationYear",
      CASE WHEN p."showEmployer" THEN p."company" ELSE NULL END AS "company",
      CASE WHEN p."showEmployer" THEN p."position" ELSE NULL END AS "position",
      p."city",
      p."countryCode",
      CASE WHEN p."showGender" THEN p."gender"::text ELSE NULL END AS "gender",
      p."bloodGroup"::text AS "bloodGroup",
      d."name" AS "departmentName",
      COUNT(*) OVER()::int AS "total"
    FROM "Profile" p
    INNER JOIN "User" u ON u."id" = p."userId"
    LEFT JOIN "Department" d ON d."id" = p."departmentId"
    ${where}
    ${orderBy}
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const total = rows[0]?.total ?? 0;
  const entries: DirectoryEntry[] = rows.map(({ total: _total, gender, bloodGroup, ...entry }) => ({
    ...entry,
    gender: gender === "MALE" || gender === "FEMALE" ? gender : null,
    bloodGroup: bloodGroup && isBloodGroup(bloodGroup) ? bloodGroup : null,
  }));

  return {
    entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export type PublicProfile = {
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  graduationYear: number | null;
  degree: string | null;
  departmentName: string | null;
  company: string | null;
  position: string | null;
  whatsappPhone: string | null;
  facebookUrl: string | null;
  linkedInUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  countryCode: string | null;
  collegeName: string | null;
  collegeDepartment: string | null;
  collegeSession: string | null;
  hscPassingYear: number | null;
  universityName: string | null;
  universityDepartment: string | null;
  universitySession: string | null;
  email: string | null;
  gender: Gender | null;
  bloodGroup: BloodGroupValue | null;
  visibility: Visibility;
  isOwnProfile: boolean;
};

/**
 * Single profile read. Unlike the directory list this allows anonymous access, but only to
 * profiles the owner explicitly marked PUBLIC.
 */
export async function getProfileBySlug(slug: string): Promise<PublicProfile | null> {
  const viewer = await getViewer();

  const profile = await prisma.profile.findUnique({
    where: { slug },
    select: {
      slug: true,
      displayName: true,
      headline: true,
      bio: true,
      avatarUrl: true,
      graduationYear: true,
      degree: true,
      company: true,
      position: true,
      whatsappPhone: true,
      facebookUrl: true,
      linkedInUrl: true,
      websiteUrl: true,
      city: true,
      countryCode: true,
      collegeName: true,
      collegeDepartment: true,
      collegeSession: true,
      hscPassingYear: true,
      universityName: true,
      universityDepartment: true,
      universitySession: true,
      visibility: true,
      showEmail: true,
      showEmployer: true,
      showGender: true,
      gender: true,
      bloodGroup: true,
      department: { select: { name: true } },
      user: { select: { id: true, email: true, status: true, deletedAt: true } },
    },
  });

  if (!profile) return null;

  const access = canViewProfile(viewer, {
    ownerId: profile.user.id,
    visibility: profile.visibility,
    ownerStatus: profile.user.status,
    ownerDeletedAt: profile.user.deletedAt,
  });

  if (!access.allowed) return null;

  const showEmployer = profile.showEmployer || access.isOwnProfile;
  // Contact channels only for verified alumni (and the owner).
  const showContact = Boolean(viewer?.isVerified) || access.isOwnProfile;
  const showEmail = (profile.showEmail && Boolean(viewer?.isVerified)) || access.isOwnProfile;
  const showGender = profile.showGender || access.isOwnProfile;

  return {
    slug: profile.slug,
    displayName: profile.displayName,
    headline: profile.headline,
    bio: profile.bio,
    avatarUrl: profile.avatarUrl,
    graduationYear: profile.graduationYear,
    degree: profile.degree,
    departmentName: profile.department?.name ?? null,
    company: showEmployer ? profile.company : null,
    position: showEmployer ? profile.position : null,
    whatsappPhone: showContact ? profile.whatsappPhone : null,
    facebookUrl: showContact ? profile.facebookUrl : null,
    linkedInUrl: profile.linkedInUrl,
    websiteUrl: profile.websiteUrl,
    city: profile.city,
    countryCode: profile.countryCode,
    collegeName: profile.collegeName,
    collegeDepartment: profile.collegeDepartment,
    collegeSession: profile.collegeSession,
    hscPassingYear: profile.hscPassingYear,
    universityName: profile.universityName,
    universityDepartment: profile.universityDepartment,
    universitySession: profile.universitySession,
    email: showEmail ? profile.user.email : null,
    gender: showGender ? profile.gender : null,
    bloodGroup: profile.bloodGroup,
    visibility: profile.visibility,
    isOwnProfile: access.isOwnProfile,
  };
}

export type EditableProfile = {
  slug: string;
  displayName: string;
  headline: string | null;
  bio: string | null;
  avatarUrl: string | null;
  graduationYear: number | null;
  degree: string | null;
  departmentId: string | null;
  company: string | null;
  position: string | null;
  whatsappPhone: string | null;
  facebookUrl: string | null;
  linkedInUrl: string | null;
  websiteUrl: string | null;
  city: string | null;
  countryCode: string | null;
  collegeName: string | null;
  collegeDepartment: string | null;
  collegeSession: string | null;
  hscPassingYear: number | null;
  universityName: string | null;
  universityDepartment: string | null;
  universitySession: string | null;
  visibility: Visibility;
  showEmail: boolean;
  showEmployer: boolean;
  showGender: boolean;
  gender: Gender | null;
  bloodGroup: BloodGroupValue | null;
  updatedAt: Date;
};

export async function getOwnProfile(): Promise<EditableProfile | null> {
  const viewer = await getViewer();
  if (!viewer) return null;

  return prisma.profile.findUnique({
    where: { userId: viewer.id },
    select: {
      slug: true,
      displayName: true,
      headline: true,
      bio: true,
      avatarUrl: true,
      graduationYear: true,
      degree: true,
      departmentId: true,
      company: true,
      position: true,
      whatsappPhone: true,
      facebookUrl: true,
      linkedInUrl: true,
      websiteUrl: true,
      city: true,
      countryCode: true,
      collegeName: true,
      collegeDepartment: true,
      collegeSession: true,
      hscPassingYear: true,
      universityName: true,
      universityDepartment: true,
      universitySession: true,
      visibility: true,
      showEmail: true,
      showEmployer: true,
      showGender: true,
      gender: true,
      bloodGroup: true,
      updatedAt: true,
    },
  });
}

export async function listDepartments() {
  return prisma.department.findMany({
    where: { name: { in: [...EDUCATION_GROUPS] } },
    orderBy: { sortkey: "asc" },
    select: { id: true, name: true },
  });
}

export type DirectoryFacets = {
  years: number[];
  countries: Array<{ code: string; count: number }>;
};

export const DIRECTORY_FILTER_OPTIONS_TAG = "directory-filter-options";

type FilterOptionsPayload = {
  departments: Array<{ id: string; name: string; slug: string }>;
  years: number[];
  countries: Array<{ code: string; count: number }>;
};

/**
 * Departments + year/country facets in one SQL round-trip, cached across requests.
 * Invalidated via DIRECTORY_FILTER_OPTIONS_TAG when an admin verifies someone.
 */
const loadDirectoryFilterOptions = unstable_cache(
  async (): Promise<FilterOptionsPayload> => {
    const rows = await prisma.$queryRaw<
      Array<{
        departments: FilterOptionsPayload["departments"] | null;
        years: number[] | null;
        countries: FilterOptionsPayload["countries"] | null;
      }>
    >`
      SELECT
        (
          SELECT COALESCE(
            json_agg(
              json_build_object('id', d."id", 'name', d."name", 'slug', d."slug")
              ORDER BY d."sortkey" ASC, d."name" ASC
            ),
            '[]'::json
          )
          FROM "Department" d
          WHERE d."name" IN (${Prisma.join([...EDUCATION_GROUPS])})
        ) AS "departments",
        (
          SELECT COALESCE(json_agg("year" ORDER BY "year" DESC), '[]'::json)
          FROM (
            SELECT DISTINCT p."graduationYear" AS "year"
            FROM "Profile" p
            INNER JOIN "User" u ON u."id" = p."userId"
            WHERE u."status" = ${"VERIFIED"}::"UserStatus"
              AND u."deletedAt" IS NULL
              AND p."graduationYear" IS NOT NULL
          ) years
        ) AS "years",
        (
          SELECT COALESCE(
            json_agg(
              json_build_object('code', "code", 'count', "count")
              ORDER BY "count" DESC, "code" ASC
            ),
            '[]'::json
          )
          FROM (
            SELECT p."countryCode" AS "code", COUNT(*)::int AS "count"
            FROM "Profile" p
            INNER JOIN "User" u ON u."id" = p."userId"
            WHERE u."status" = ${"VERIFIED"}::"UserStatus"
              AND u."deletedAt" IS NULL
              AND p."countryCode" IS NOT NULL
            GROUP BY p."countryCode"
          ) countries
        ) AS "countries"
    `;

    const row = rows[0];
    return {
      departments: row?.departments ?? [],
      years: row?.years ?? [],
      countries: row?.countries ?? [],
    };
  },
  ["directory-filter-options-v1"],
  { revalidate: 120, tags: [DIRECTORY_FILTER_OPTIONS_TAG] },
);

/** Auth-gated wrapper: cache is shared; gating stays per-request. */
export async function getDirectoryFilterOptions(): Promise<FilterOptionsPayload> {
  const viewer = await getViewer();
  if (!viewer?.isVerified) {
    return { departments: [], years: [], countries: [] };
  }
  if (!viewer.isAdmin && !viewer.profileComplete) {
    return { departments: [], years: [], countries: [] };
  }
  return loadDirectoryFilterOptions();
}

/** Facet values are derived from verified profiles only, so filters never hint at hidden rows. */
export async function getDirectoryFacets(): Promise<DirectoryFacets> {
  const { years, countries } = await getDirectoryFilterOptions();
  return { years, countries };
}

export type NetworkStats = {
  verifiedAlumni: number;
  countries: number;
  earliestYear: number | null;
  latestYear: number | null;
};

const EMPTY_STATS: NetworkStats = {
  verifiedAlumni: 0,
  countries: 0,
  earliestYear: null,
  latestYear: null,
};

/**
 * Aggregate counts only, safe to render on the public landing page. A database outage
 * degrades to hiding the numbers rather than failing the one page an unauthenticated
 * visitor can reach.
 */
export async function getNetworkStats(): Promise<NetworkStats> {
  try {
    const rows = await prisma.$queryRaw<
      Array<{
        verifiedAlumni: number;
        countries: number;
        earliestYear: number | null;
        latestYear: number | null;
      }>
    >`
      SELECT
        COUNT(*)::int AS "verifiedAlumni",
        COUNT(DISTINCT p."countryCode")::int AS "countries",
        MIN(p."graduationYear")::int AS "earliestYear",
        MAX(p."graduationYear")::int AS "latestYear"
      FROM "Profile" p
      INNER JOIN "User" u ON u."id" = p."userId"
      WHERE u."status" = ${"VERIFIED"}::"UserStatus" AND u."deletedAt" IS NULL
    `;

    return rows[0] ?? EMPTY_STATS;
  } catch (error) {
    console.error("[dal] network stats unavailable:", error);
    return EMPTY_STATS;
  }
}
