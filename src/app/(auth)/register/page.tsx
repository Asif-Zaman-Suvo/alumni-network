import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isGoogleEnabled } from "@/auth.config";
import { RegisterOptions } from "@/components/auth/register-options";
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
        isAdmin: viewer.isAdmin,
      }),
    );
  }

  const googleEnabled = isGoogleEnabled;

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Request access</h1>
        <p className="text-sm text-muted-foreground">
          {googleEnabled
            ? "Prefer Continue with Google — you only confirm SSC details on the next screen. Email signup is for people without a Google account."
            : "Accounts are activated after an administrator confirms your SSC details."}
        </p>
      </div>

      <RegisterOptions googleEnabled={googleEnabled} />

      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
