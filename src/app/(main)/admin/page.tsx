import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClockIcon, TriangleAlertIcon, UserCheckIcon, UserXIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getReviewCounts } from "@/lib/dal/admin";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

const STALE_QUEUE_DAYS = 7;

export default function AdminOverviewPage() {
  return (
    <Suspense fallback={<OverviewSkeleton />}>
      <OverviewBody />
    </Suspense>
  );
}

async function OverviewBody() {
  const counts = await getReviewCounts();

  const cards = [
    { label: "Awaiting review", value: counts.pending, icon: ClockIcon, tone: "warning" as const },
    { label: "Verified alumni", value: counts.verified, icon: UserCheckIcon, tone: "success" as const },
    { label: "Rejected", value: counts.rejected, icon: UserXIcon, tone: "muted" as const },
    {
      label: "Signed up, not submitted",
      value: counts.unverified,
      icon: TriangleAlertIcon,
      tone: "muted" as const,
    },
  ];

  return (
    <div className="space-y-6">
      {counts.oldestPendingAt && counts.oldestPendingAgeDays > STALE_QUEUE_DAYS ? (
        <Alert variant="warning">
          <TriangleAlertIcon />
          <AlertTitle>Someone has been waiting a while</AlertTitle>
          <AlertDescription>
            The oldest pending request was submitted{" "}
            {formatDistanceToNow(counts.oldestPendingAt, { addSuffix: true })}. The queue is
            sorted oldest first, so start at the top.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardContent className="pt-6">
              <card.icon
                className={
                  card.tone === "warning"
                    ? "size-5 text-warning"
                    : card.tone === "success"
                      ? "size-5 text-success"
                      : "size-5 text-muted-foreground"
                }
              />
              <p className="mt-3 text-3xl font-semibold tabular-nums">
                {card.value.toLocaleString()}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What needs a human</CardTitle>
          <CardDescription>
            There is no roster to match against, so every account is approved or rejected by a
            person. Certificates are the only evidence a reviewer has.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/admin/verifications">
              Open the review queue
              {counts.pending > 0 ? ` (${counts.pending})` : ""}
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin/users">Manage users</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function OverviewSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-36 rounded-xl" />
    </div>
  );
}
