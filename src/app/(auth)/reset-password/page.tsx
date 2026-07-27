import type { Metadata } from "next";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/auth/password-forms";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage(props: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await props.searchParams;

  if (!token) {
    return (
      <div className="space-y-6">
        <Alert variant="destructive">
          <AlertTitle>This link is not valid</AlertTitle>
          <AlertDescription>
            The reset link is missing its token. Request a new one and try again.
          </AlertDescription>
        </Alert>
        <Link href="/forgot-password" className="text-sm font-medium text-primary hover:underline">
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="text-sm text-muted-foreground">
          This link works once and expires an hour after it was sent.
        </p>
      </div>

      <ResetPasswordForm token={token} />
    </div>
  );
}
