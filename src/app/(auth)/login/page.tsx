import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/auth.config";
import { GoogleButton } from "@/components/auth/google-button";
import { LoginForm } from "@/components/auth/login-form";
import { Separator } from "@/components/ui/separator";
import { homeForStatus } from "@/lib/auth-routes";
import { getViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage(props: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  // Next 16: searchParams is a Promise and must be awaited.
  const searchParams = await props.searchParams;

  const viewer = await getViewer();
  if (viewer) {
    const home = homeForStatus(viewer.status, {
      profileComplete: viewer.profileComplete,
      isStaff: viewer.isStaff,
    });
    const dest =
      viewer.isVerified &&
      viewer.profileComplete &&
      searchParams.callbackUrl?.startsWith("/")
        ? searchParams.callbackUrl
        : home;
    redirect(dest);
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to browse the alumni directory.
        </p>
      </div>

      <LoginForm callbackUrl={searchParams.callbackUrl} />

      {isGoogleEnabled ? (
        <>
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
              or
            </span>
          </div>
          <GoogleButton callbackUrl={searchParams.callbackUrl ?? "/onboarding"} />
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-primary hover:underline">
          Request access
        </Link>
      </p>
    </div>
  );
}
