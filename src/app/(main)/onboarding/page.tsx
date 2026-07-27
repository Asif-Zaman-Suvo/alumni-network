import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { InfoIcon } from "lucide-react";
import { SscForm } from "@/components/verification/ssc-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnVerificationState } from "@/lib/dal/verification";
import { requireViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Confirm you studied here",
  robots: { index: false, follow: false },
};

/**
 * Where Google sign-ups land. OAuth cannot collect SSC details during the redirect, so this
 * is the step that turns an UNVERIFIED account into a reviewable request.
 */
export default async function OnboardingPage() {
  const viewer = await requireViewer();
  if (viewer.isVerified) redirect("/directory");
  if (viewer.status === "PENDING" || viewer.status === "REJECTED") {
    redirect("/verification-status");
  }

  const state = await getOwnVerificationState();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">One more step</CardTitle>
          <CardDescription>
            Your account is created. Now confirm that you are a former student so an
            administrator can activate it.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <Alert variant="info">
            <InfoIcon />
            <AlertTitle>These numbers stay private</AlertTitle>
            <AlertDescription>
              Your roll and registration numbers are only visible to administrators. They are
              never shown in the directory or on your profile.
            </AlertDescription>
          </Alert>

          <SscForm
            defaultName={viewer.name ?? undefined}
            attemptsRemaining={state.attemptsRemaining}
          />
        </CardContent>
      </Card>
    </div>
  );
}
