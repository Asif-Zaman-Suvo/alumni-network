import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/auth.config";
import { homeForStatus } from "@/lib/auth-routes";
import type { UserStatus } from "@prisma/client";

/**
 * Next 16 renamed `middleware` to `proxy`. It runs on the Node.js runtime (not Edge, and
 * that is not configurable), but this file still uses the database-free Auth.js instance so
 * request interception only decodes the JWT.
 *
 * This is a routing convenience, not the security boundary. Every read is independently
 * gated in src/lib/dal/*, because a proxy matcher mistake must not be able to leak data.
 */
const { auth } = NextAuth(authConfig);

/** Reachable without a session. Public profiles are filtered by the DAL, not here. */
const PUBLIC_PATHS = new Set([
  "/",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
]);

const PUBLIC_PREFIXES = ["/profile/"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.has(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  );
}

function redirect(path: string, url: URL): NextResponse {
  return NextResponse.redirect(new URL(path, url));
}

function isAllowedForStatus(pathname: string, status: UserStatus | undefined): boolean {
  switch (status) {
    case "UNVERIFIED":
      return pathname === "/onboarding";
    case "PENDING":
    case "REJECTED":
      return pathname === "/verification-status";
    case "VERIFIED":
      // Incomplete profiles may still reach settings to finish required fields.
      if (pathname === "/onboarding" || pathname === "/verification-status") return false;
      return true;
    default:
      // Incomplete JWT (missing status) — only onboarding, and never bounce onto itself.
      return pathname === "/onboarding";
  }
}

export const proxy = auth((request) => {
  const { nextUrl } = request;
  const { pathname } = nextUrl;
  const session = request.auth;

  if (!session?.user) {
    if (isPublic(pathname)) return NextResponse.next();

    const target = new URL("/login", nextUrl);
    target.searchParams.set("callbackUrl", `${pathname}${nextUrl.search}`);
    return NextResponse.redirect(target);
  }

  const { status, role, profileComplete } = session.user;
  const isStaff = role === "ADMIN" || role === "MODERATOR";
  const isAdminArea = pathname.startsWith("/admin");

  // Always allow auth screens through. Pages call getViewer() and redirect when the
  // session is healthy. Bouncing here when the cookie decodes in the proxy but fails
  // in auth() (JWTSessionError) caused ERR_TOO_MANY_REDIRECTS on /verification-status.
  if (pathname === "/login" || pathname === "/register") {
    return NextResponse.next();
  }

  // Session claim refresh after admin approval — must run for PENDING JWTs.
  if (pathname === "/api/session/sync") {
    return NextResponse.next();
  }

  if (!isAllowedForStatus(pathname, status)) {
    return redirect(
      homeForStatus(status, { profileComplete, isStaff }),
      nextUrl,
    );
  }

  if (status === "VERIFIED" && isAdminArea && !isStaff) {
    return redirect(
      homeForStatus(status, { profileComplete, isStaff }),
      nextUrl,
    );
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Everything except Next internals, the Auth.js handler and static assets.
     * The Auth.js routes must be excluded or the sign-in callback would be redirected
     * before it can set the session cookie.
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)",
  ],
};
