import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
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
  emailVerified: boolean;
  profileComplete: boolean;
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
    emailVerified: Boolean(user.isEmailVerified),
    profileComplete: Boolean(user.profileComplete),
  };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/**
 * When the JWT still says PENDING/REJECTED/UNVERIFIED, compare with Postgres.
 * Cookie updates cannot run in a Server Component — if claims drifted, bounce through
 * `/api/session/sync` (Route Handler) which refreshes the JWT then redirects home.
 */
export async function requireViewerWithFreshStatus(): Promise<Viewer> {
  const viewer = await requireViewer();
  if (viewer.isVerified) return viewer;

  const fresh = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: {
      status: true,
      profileComplete: true,
      emailVerified: true,
      deletedAt: true,
    },
  });

  if (!fresh || fresh.deletedAt) redirect("/login");

  const emailVerified = Boolean(fresh.emailVerified);
  const claimsChanged =
    fresh.status !== viewer.status ||
    fresh.profileComplete !== viewer.profileComplete ||
    emailVerified !== viewer.emailVerified;

  if (claimsChanged) {
    redirect("/api/session/sync");
  }

  if (fresh.status === "UNVERIFIED") redirect("/onboarding");

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

/**
 * Directory + member data require an approved account AND required contact fields
 * (WhatsApp + Facebook). Staff bypass the profile gate.
 */
export async function requireDirectoryAccess(): Promise<Viewer> {
  const viewer = await requireVerifiedViewer();
  if (!viewer.isStaff && !viewer.profileComplete) {
    redirect("/settings/profile?complete=1");
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
