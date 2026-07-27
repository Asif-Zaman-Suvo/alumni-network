import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { InboxIcon } from "lucide-react";
import { ReviewQueue } from "@/components/admin/review-queue";
import { Pagination } from "@/components/directory/pagination";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getReviewQueue } from "@/lib/dal/admin";
import { requireStaffViewer } from "@/lib/dal/session";
import { cn } from "@/lib/utils";
import type { UserStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Review queue",
  robots: { index: false, follow: false },
};

const STATUS_TABS: Array<{ value: UserStatus; label: string }> = [
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
];

type SearchParams = { status?: string; year?: string; q?: string; page?: string };

function parseInteger(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default function VerificationsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<QueueSkeleton />}>
      <VerificationsBody searchParams={props.searchParams} />
    </Suspense>
  );
}

async function VerificationsBody({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const viewer = await requireStaffViewer();
  const searchParams = await searchParamsPromise;

  const status = STATUS_TABS.some((tab) => tab.value === searchParams.status)
    ? (searchParams.status as UserStatus)
    : "PENDING";

  const queue = await getReviewQueue({
    status,
    passingYear: parseInteger(searchParams.year),
    q: searchParams.q,
    page: parseInteger(searchParams.page) ?? 1,
  });

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") baseParams.set(key, value);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="flex gap-1">
          {STATUS_TABS.map((tab) => (
            <Link
              key={tab.value}
              href={`/admin/verifications?status=${tab.value}`}
              prefetch
              className={cn(
                buttonVariants({
                  variant: status === tab.value ? "secondary" : "ghost",
                  size: "sm",
                }),
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <p className="text-sm text-muted-foreground">
          {queue.total.toLocaleString()} {queue.total === 1 ? "request" : "requests"}
          {status === "PENDING" ? " · oldest first" : ""}
        </p>
      </div>

      <form method="get" className="flex flex-wrap gap-2" action="/admin/verifications">
        <input type="hidden" name="status" value={status} />
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Name, email, roll or registration"
          className="h-9 min-w-64 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <input
          name="year"
          type="number"
          defaultValue={searchParams.year ?? ""}
          placeholder="Passing year"
          className="h-9 w-36 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
          Filter
        </button>
      </form>

      {queue.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <InboxIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">Nothing here</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              {status === "PENDING"
                ? "The queue is clear. New requests appear here as they are submitted."
                : "No requests match this filter."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ReviewQueue items={queue.items} canDecide={status === "PENDING"} />
      )}

      <Pagination
        page={queue.page}
        totalPages={queue.totalPages}
        baseParams={baseParams}
        pathname="/admin/verifications"
      />

      <p className="text-xs text-muted-foreground">
        Signed in as {viewer.email}. Every approval and rejection is written to the audit log.
      </p>
    </div>
  );
}

function QueueSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-64" />
      <Skeleton className="h-9 w-full" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}
