import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/auth.config";
import { GoogleButton } from "@/components/auth/google-button";
import { RegisterForm } from "@/components/auth/register-form";
import { Separator } from "@/components/ui/separator";
import { homeForStatus } from "@/lib/auth-routes";
import { getViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Request access",
  robots: { index: false, follow: false },
};

export default async function RegisterPage() {
  const viewer = await getViewer();
  if (viewer) {
    redirect(
      homeForStatus(viewer.status, {
        profileComplete: viewer.profileComplete,
        isStaff: viewer.isStaff,
      }),
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request access</h1>
        <p className="text-sm text-muted-foreground">
          Accounts are activated after an administrator confirms your SSC details.
        </p>
      </div>

      <RegisterForm />

      {isGoogleEnabled ? (
        <>
          <div className="relative">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
              or
            </span>
          </div>
          <div className="space-y-2">
            <GoogleButton />
            <p className="text-xs text-muted-foreground">
              You will be asked for your SSC details on the next screen.
            </p>
          </div>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
