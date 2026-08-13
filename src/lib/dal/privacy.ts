import type { Role, UserStatus, Visibility } from "@prisma/client";

/**
 * Pure privacy predicates. Kept free of Prisma and Auth.js so they can be unit-tested
 * without a database, and so the list and detail code paths share one definition of
 * "who can see what".
 */

export type PrivacyViewer = {
  id: string;
  status: UserStatus;
  role: Role;
  isVerified: boolean;
  isAdmin: boolean;
};

/** Visibility levels a viewer may see in a directory listing. */
export function directoryVisibilityLevels(viewer: PrivacyViewer): Visibility[] {
  if (viewer.isAdmin) return ["PUBLIC", "MEMBERS_ONLY", "PRIVATE"];
  return ["PUBLIC", "MEMBERS_ONLY"];
}

type ProfileAccessInput = {
  ownerId: string;
  visibility: Visibility;
  ownerStatus: UserStatus;
  ownerDeletedAt: Date | null;
};

/**
 * Whether a viewer may open a single profile page. Anonymous visitors only see PUBLIC
 * profiles of verified, non-deleted owners.
 */
export function canViewProfile(
  viewer: PrivacyViewer | null,
  profile: ProfileAccessInput,
): { allowed: boolean; isOwnProfile: boolean } {
  const isOwnProfile = viewer?.id === profile.ownerId;

  if (profile.ownerDeletedAt || profile.ownerStatus !== "VERIFIED") {
    return { allowed: isOwnProfile, isOwnProfile };
  }

  if (isOwnProfile) return { allowed: true, isOwnProfile: true };
  if (viewer?.isAdmin) return { allowed: true, isOwnProfile: false };
  if (profile.visibility === "PUBLIC") return { allowed: true, isOwnProfile: false };
  if (profile.visibility === "MEMBERS_ONLY" && viewer?.isVerified) {
    return { allowed: true, isOwnProfile: false };
  }

  return { allowed: false, isOwnProfile: false };
}

/** Columns that must never appear on a non-admin payload. */
export const FORBIDDEN_PUBLIC_FIELDS = [
  "sscRoll",
  "sscRegistration",
  "documentPath",
  "passwordHash",
] as const;

export function assertNoSensitiveFields(payload: Record<string, unknown>): void {
  for (const field of FORBIDDEN_PUBLIC_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      throw new Error(`Sensitive field leaked into public payload: ${field}`);
    }
  }
}
