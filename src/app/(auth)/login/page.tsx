import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/auth.config";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { homeForStatus } from "@/lib/auth-routes";
import { getViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

function oauthErrorCopy(error: string | undefined): { title: string; body: string } | null {
  switch (error) {
    case "OAuthAccountNotLinked":
      return {
        title: "Email already registered",
        body: "An account with this email already exists. Sign in with your password, then link Google from profile settings — or try Continue with Google again after restarting the app.",
      };
    case "OAuthCallback":
    case "Callback":
      return {
        title: "Sign-in interrupted",
        body: "Google did not finish signing you in. Try again.",
      };
    case "AccessDenied":
      return {
        title: "Access denied",
        body: "Google did not grant access. Try again or use email and password.",
      };
    case undefined:
    case "":
      return null;
    default:
      return {
        title: "Could not sign in",
        body: "Something went wrong with social sign-in. Try email and password, or try again.",
      };
  }
}

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

  const googleEnabled = isGoogleEnabled;
  const oauthError = oauthErrorCopy(searchParams.error);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-sm text-muted-foreground">
          Sign in to browse the alumni directory.
        </p>
      </div>

      {oauthError ? (
        <Alert variant="destructive">
          <AlertTitle>{oauthError.title}</AlertTitle>
          <AlertDescription>{oauthError.body}</AlertDescription>
        </Alert>
      ) : null}

      <LoginForm callbackUrl={searchParams.callbackUrl} />

      {googleEnabled ? (
        <>
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
              or
            </span>
          </div>
          <OAuthButtons callbackUrl={searchParams.callbackUrl ?? "/onboarding"} />
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
