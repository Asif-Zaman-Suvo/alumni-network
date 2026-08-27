import type { Metadata } from "next";
import { formatDistanceToNow } from "date-fns";
import { ClockIcon, FileTextIcon, TriangleAlertIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { SscForm } from "@/components/verification/ssc-form";
import { StatusRefresh } from "@/components/verification/status-refresh";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { getOwnVerificationState } from "@/lib/dal/verification";
import { requireViewerWithFreshStatus } from "@/lib/dal/session";
import { homeForStatus } from "@/lib/auth-routes";

export const metadata: Metadata = {
  title: "Verification status",
  robots: { index: false, follow: false },
};

export default async function VerificationStatusPage() {
  const viewer = await requireViewerWithFreshStatus();
  if (viewer.status === "UNVERIFIED") redirect("/onboarding");
  if (viewer.isVerified) {
    redirect(
      homeForStatus("VERIFIED", {
        profileComplete: viewer.profileComplete,
        isAdmin: viewer.isAdmin,
      }),
    );
  }

  const state = await getOwnVerificationState();
  const latest = state.latest;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-12 sm:px-6">
      <StatusRefresh />
      {state.status === "PENDING" ? (
        <Card>
          <CardHeader>
            <Badge variant="warning" className="w-fit">
              <ClockIcon />
              Awaiting review
            </Badge>
            <CardTitle className="pt-2 text-xl">Your request is with our team</CardTitle>
            <CardDescription>
              An administrator is checking your SSC roll and registration number against
              school records. You will get an email as soon as a decision is made.
            </CardDescription>
          </CardHeader>
          {latest ? (
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 rounded-lg border border-border bg-muted/40 p-4 text-sm">
                <div>
                  <dt className="text-muted-foreground">Name submitted</dt>
                  <dd className="mt-0.5 font-medium">{latest.fullNameOnCert}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Passing year</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{latest.passingYear}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Roll number</dt>
                  <dd className="mt-0.5 font-medium tabular-nums">{latest.sscRollMasked}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd className="mt-0.5 font-medium">
                    {formatDistanceToNow(latest.createdAt, { addSuffix: true })}
                  </dd>
                </div>
              </dl>

              {!latest.hasDocument ? (
                <Alert variant="warning" className="mt-4">
                  <FileTextIcon />
                  <AlertTitle>No certificate attached</AlertTitle>
                  <AlertDescription>
                    Requests without a marksheet or certificate take longer, because the
                    reviewer has nothing to check the numbers against.
                  </AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          ) : null}
        </Card>
      ) : null}

      {state.status === "REJECTED" ? (
        <>
          <Alert variant="destructive">
            <TriangleAlertIcon />
            <AlertTitle>We could not verify your details</AlertTitle>
            <AlertDescription>
              {latest?.reviewNote ?? "An administrator could not confirm your submission."}
            </AlertDescription>
          </Alert>

          {state.canResubmit ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Correct your details and try again</CardTitle>
                <CardDescription>
                  Double-check the numbers on your marksheet, and attach a photo of it this
                  time if you did not before.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SscForm
                  defaultName={latest?.fullNameOnCert ?? viewer.name ?? undefined}
                  attemptsRemaining={state.attemptsRemaining}
                />
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">
                  You have used all three submission attempts. Please contact the alumni
                  office directly so someone can look into it with you.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {state.attempts.length > 1 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submission history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {state.attempts.map((attempt, index) => (
              <div key={attempt.id}>
                {index > 0 ? <Separator className="mb-3" /> : null}
                <div className="flex items-start justify-between gap-4 text-sm">
                  <div>
                    <p className="font-medium">
                      {attempt.fullNameOnCert} · {attempt.passingYear}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Roll {attempt.sscRollMasked} ·{" "}
                      {formatDistanceToNow(attempt.createdAt, { addSuffix: true })}
                    </p>
                    {attempt.reviewNote ? (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reviewer note: {attempt.reviewNote}
                      </p>
                    ) : null}
                  </div>
                  <Badge
                    variant={
                      attempt.status === "VERIFIED"
                        ? "success"
                        : attempt.status === "REJECTED"
                          ? "destructive"
                          : "warning"
                    }
                  >
                    {attempt.status.toLowerCase()}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
