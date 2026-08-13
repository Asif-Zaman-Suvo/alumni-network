"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { unstable_update } from "@/auth";
import { signOut } from "@/auth";
import { actionError, actionOk, fromZodError, type ActionResult } from "@/lib/action-result";
import { AUDIT_REASONS } from "@/lib/audit-events";
import { getRequestContext, revokeUserSessions } from "@/lib/auth/session-lifecycle";
import { DIRECTORY_FILTER_OPTIONS_TAG } from "@/lib/dal/profiles";
import { getViewer } from "@/lib/dal/session";
import { prisma } from "@/lib/prisma";
import { removeAvatar, uploadAvatar } from "@/lib/storage";
import { profileSchema } from "@/lib/validation";

export async function updateProfileAction(formData: FormData): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return actionError("Please sign in again.");
  if (!viewer.isVerified) {
    return actionError("Your account must be verified before you can publish a profile.");
  }

  const raw = Object.fromEntries(formData);
  const parsed = profileSchema.safeParse({
    ...raw,
    // Unchecked switches are absent from FormData entirely.
    showEmail: formData.get("showEmail") === "on" || formData.get("showEmail") === "true",
    showEmployer:
      formData.get("showEmployer") === "on" || formData.get("showEmployer") === "true",
  });

  if (!parsed.success) return fromZodError(parsed.error);

  const data = parsed.data;

  const existing = await prisma.profile.findUnique({
    where: { userId: viewer.id },
    select: { id: true, slug: true, avatarUrl: true },
  });
  if (!existing) return actionError("Profile not found.");

  let avatarUrl = existing.avatarUrl;
  const avatar = formData.get("avatar");
  if (avatar instanceof File && avatar.size > 0) {
    const upload = await uploadAvatar(viewer.id, avatar);
    if (!upload.ok) return actionError(upload.error, { avatar: [upload.error] });

    if (existing.avatarUrl && existing.avatarUrl !== upload.path) {
      await removeAvatar(existing.avatarUrl);
    }
    avatarUrl = upload.path;
  }

  // Department is a lookup table, so reject unknown ids rather than silently nulling them.
  if (data.departmentId) {
    const department = await prisma.department.findUnique({
      where: { id: data.departmentId },
      select: { id: true },
    });
    if (!department) {
      return actionError("Unknown department.", { departmentId: ["Choose a valid department"] });
    }
  }

  await prisma.profile.update({
    where: { id: existing.id },
    data: {
      displayName: data.displayName,
      headline: data.headline ?? null,
      bio: data.bio ?? null,
      graduationYear: data.graduationYear ?? null,
      degree: data.degree ?? null,
      departmentId: data.departmentId ?? null,
      company: data.company ?? null,
      position: data.position ?? null,
      whatsappPhone: data.whatsappPhone,
      facebookUrl: data.facebookUrl,
      linkedInUrl: data.linkedInUrl ?? null,
      websiteUrl: data.websiteUrl ?? null,
      city: data.city ?? null,
      countryCode: data.countryCode ?? null,
      collegeName: data.collegeName ?? null,
      collegeDepartment: data.collegeDepartment ?? null,
      collegeSession: data.collegeSession ?? null,
      hscPassingYear: data.hscPassingYear ?? null,
      universityName: data.universityName ?? null,
      universityDepartment: data.universityDepartment ?? null,
      universitySession: data.universitySession ?? null,
      visibility: data.visibility,
      showEmail: data.showEmail,
      showEmployer: data.showEmployer,
      avatarUrl,
    },
  });

  const profileComplete = Boolean(data.whatsappPhone?.trim() && data.facebookUrl?.trim());
  await prisma.user.update({
    where: { id: viewer.id },
    data: { profileComplete },
  });

  // Refresh JWT so proxy/directory gates see profileComplete without waiting for hourly refresh.
  await unstable_update({
    user: { profileComplete },
  });

  revalidatePath("/settings/profile");
  revalidatePath(`/profile/${existing.slug}`);
  revalidatePath("/directory");
  revalidateTag(DIRECTORY_FILTER_OPTIONS_TAG, "max");

  return actionOk(
    undefined,
    profileComplete
      ? "Profile saved."
      : "Profile saved. Add WhatsApp and Facebook to unlock the directory.",
  );
}

export type PersonalDataExport = {
  exportedAt: string;
  account: {
    email: string;
    role: string;
    status: string;
    createdAt: string;
    emailVerified: string | null;
  };
  profile: {
    slug: string;
    displayName: string;
    headline: string | null;
    bio: string | null;
    graduationYear: number | null;
    degree: string | null;
    company: string | null;
    position: string | null;
    whatsappPhone: string | null;
    linkedInUrl: string | null;
    facebookUrl: string | null;
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
    visibility: string;
    showEmail: boolean;
    showEmployer: boolean;
  } | null;
  verificationRequests: Array<{
    sscRoll: string;
    sscRegistration: string;
    passingYear: number;
    fullNameOnCert: string;
    status: string;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
  }>;
};

/** Subject-access export. Includes the caller's own SSC fields; never anyone else's. */
export async function exportOwnDataAction(): Promise<ActionResult<PersonalDataExport>> {
  const viewer = await getViewer();
  if (!viewer) return actionError("Please sign in again.");

  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: {
      email: true,
      role: true,
      status: true,
      createdAt: true,
      emailVerified: true,
      profile: {
        select: {
          slug: true,
          displayName: true,
          headline: true,
          bio: true,
          graduationYear: true,
          degree: true,
          company: true,
          position: true,
          whatsappPhone: true,
          linkedInUrl: true,
          facebookUrl: true,
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
        },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        select: {
          sscRoll: true,
          sscRegistration: true,
          passingYear: true,
          fullNameOnCert: true,
          status: true,
          reviewNote: true,
          createdAt: true,
          reviewedAt: true,
        },
      },
    },
  });

  if (!user) return actionError("Account not found.");

  return actionOk({
    exportedAt: new Date().toISOString(),
    account: {
      email: user.email,
      role: user.role,
      status: user.status,
      createdAt: user.createdAt.toISOString(),
      emailVerified: user.emailVerified?.toISOString() ?? null,
    },
    profile: user.profile,
    verificationRequests: user.verifications.map((request) => ({
      ...request,
      createdAt: request.createdAt.toISOString(),
      reviewedAt: request.reviewedAt?.toISOString() ?? null,
    })),
  });
}

/**
 * Self-service deletion. The row is soft deleted so the audit trail survives, but every
 * field a directory could surface is cleared immediately.
 */
export async function deleteOwnAccountAction(): Promise<ActionResult> {
  const viewer = await getViewer();
  if (!viewer) return actionError("Please sign in again.");

  const profile = await prisma.profile.findUnique({
    where: { userId: viewer.id },
    select: { id: true, avatarUrl: true },
  });

  if (profile?.avatarUrl) await removeAvatar(profile.avatarUrl);

  await prisma.$transaction(async (tx) => {
    if (profile) {
      await tx.profile.update({
        where: { id: profile.id },
        data: {
          displayName: "Former member",
          headline: null,
          bio: null,
          avatarUrl: null,
          company: null,
          position: null,
          whatsappPhone: null,
          linkedInUrl: null,
          facebookUrl: null,
          websiteUrl: null,
          city: null,
          countryCode: null,
          degree: null,
          collegeName: null,
          collegeDepartment: null,
          collegeSession: null,
          hscPassingYear: null,
          universityName: null,
          universityDepartment: null,
          universitySession: null,
          visibility: "PRIVATE",
          showEmail: false,
          showEmployer: false,
        },
      });
    }

    await tx.user.update({
      where: { id: viewer.id },
      data: { deletedAt: new Date() },
    });

    // Includes the session running this request, so the sign-out below finds nothing left to
    // close and the LOGOUT event does not compete with SESSION_REVOKED for the same session.
    await revokeUserSessions(tx, {
      userId: viewer.id,
      reason: AUDIT_REASONS.accountClosed,
      context: await getRequestContext(),
    });
  });

  await signOut({ redirect: false });

  return actionOk(undefined, "Your account has been closed.");
}
