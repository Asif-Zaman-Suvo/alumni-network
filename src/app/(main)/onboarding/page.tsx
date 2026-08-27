import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SscForm } from "@/components/verification/ssc-form";
import { StatusRefresh } from "@/components/verification/status-refresh";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getOwnVerificationState } from "@/lib/dal/verification";
import { requireViewerWithFreshStatus } from "@/lib/dal/session";
import { homeForStatus } from "@/lib/auth-routes";

export const metadata: Metadata = {
  title: "Confirm you studied here",
  robots: { index: false, follow: false },
};

/**
 * Where Google first-time sign-ins land. OAuth cannot collect SSC during the
 * provider redirect. Email+password signup already collected SSC on /register and never
 * visits this page.
 *
 * Submitting SSC here either blocks when those numbers already belong to a VERIFIED
 * alumni (sign in with that account instead), or opens a PENDING admin review for a
 * new claim.
 */
export default async function OnboardingPage() {
  const viewer = await requireViewerWithFreshStatus();
  if (viewer.isVerified) {
    redirect(
      homeForStatus("VERIFIED", {
        profileComplete: viewer.profileComplete,
        isAdmin: viewer.isAdmin,
      }),
    );
  }
  if (viewer.status === "PENDING" || viewer.status === "REJECTED") {
    redirect("/verification-status");
  }

  const state = await getOwnVerificationState();

  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
      <StatusRefresh />
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">One more step</CardTitle>
          <CardDescription>
            Confirm you studied here. If these numbers already belong to an approved alumni
            account, we will ask you to sign in with that account instead. Otherwise an
            administrator will review your request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SscForm
            defaultName={viewer.name ?? undefined}
            attemptsRemaining={state.attemptsRemaining}
          />
        </CardContent>
      </Card>
    </div>
  );
}
