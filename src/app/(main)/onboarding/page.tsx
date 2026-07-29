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
 * Where Google first-time sign-ins land. OAuth cannot collect SSC during the
 * provider redirect. Email+password signup already collected SSC on /register and never
 * visits this page.
 *
 * Submitting SSC here either links this login to an already-VERIFIED alumni account, or
 * opens a PENDING admin review for a new claim.
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
            Confirm you studied here. If you already have an approved alumni account, these
            numbers will link this social login to it. Otherwise an administrator will review
            your request.
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
