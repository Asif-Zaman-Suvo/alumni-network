import { NextResponse } from "next/server";
import { auth, unstable_update } from "@/auth";
import { homeForStatus } from "@/lib/auth-routes";
import { prisma } from "@/lib/prisma";

/**
 * Refreshes JWT claims from Postgres. Cookie writes are illegal in Server Components,
 * so status pages and the proxy redirect here after detecting a stale session.
 */
export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const fresh = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      status: true,
      profileComplete: true,
      deletedAt: true,
      role: true,
    },
  });

  if (!fresh || fresh.deletedAt) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Route Handler may set cookies; jwt callback reloads claims from the DB.
  await unstable_update({});

  const destination = homeForStatus(fresh.status, {
    profileComplete: fresh.profileComplete,
    isAdmin: fresh.role === "ADMIN",
  });

  return NextResponse.redirect(new URL(destination, request.url));
}
