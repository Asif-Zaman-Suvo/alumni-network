import type { UserStatus } from "@prisma/client";

/**
 * Where a signed-in user should land given their verification status.
 * Shared by the proxy and auth pages so they never disagree (which causes redirect loops).
 */
export function homeForStatus(
  status: UserStatus | undefined | null,
  options?: { profileComplete?: boolean; isStaff?: boolean },
): string {
  switch (status) {
    case "VERIFIED":
      if (!options?.isStaff && options?.profileComplete === false) {
        return "/settings/profile?complete=1";
      }
      return "/directory";
    case "PENDING":
    case "REJECTED":
      return "/verification-status";
    case "UNVERIFIED":
    default:
      return "/onboarding";
  }
}
