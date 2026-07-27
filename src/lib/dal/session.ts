import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import type { Role, UserStatus } from "@prisma/client";

export type Viewer = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  status: UserStatus;
  isVerified: boolean;
  isStaff: boolean;
};

/**
 * The single source of truth for "who is asking". Every DAL function starts here so the
 * viewer's status is never taken from a component prop or a request parameter.
 *
 * Wrapped in React.cache so SiteHeader, requireVerifiedViewer, searchDirectory and
 * getDirectoryFacets share one auth()/JWT decode per request instead of N round-trips.
 */
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth();
  const user = session?.user;
  if (!user?.id || !user.email) return null;

  return {
    id: user.id,
    email: user.email,
    name: user.name ?? null,
    image: user.image ?? null,
    role: user.role,
    status: user.status,
    isVerified: user.status === "VERIFIED",
    isStaff: user.role === "ADMIN" || user.role === "MODERATOR",
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** For pages and actions that may only be reached by an approved alumnus. */
export async function requireVerifiedViewer(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!viewer.isVerified) {
    redirect(viewer.status === "UNVERIFIED" ? "/onboarding" : "/verification-status");
  }
  return viewer;
}

export async function requireStaffViewer(): Promise<Viewer> {
  const viewer = await requireVerifiedViewer();
  if (!viewer.isStaff) redirect("/directory");
  return viewer;
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to do that.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Server Action variant: throws rather than redirecting, so the caller can return a form error. */
export async function assertStaff(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer || !viewer.isVerified || !viewer.isStaff) throw new ForbiddenError();
  return viewer;
}
