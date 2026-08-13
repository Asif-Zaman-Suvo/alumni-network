import type { Metadata } from "next";
import { Suspense } from "react";
import { AuditLogLive, type AuditRow } from "@/components/admin/audit-log-live";
import { Skeleton } from "@/components/ui/skeleton";
import { clientEnv } from "@/env";
import { AUDIT_PAGE_SIZE, listAuditLogPage } from "@/lib/dal/audit-read";
import { requireAdminViewer } from "@/lib/dal/session";
import { isRealtimeConfigured } from "@/lib/supabase/realtime-token";

export const metadata: Metadata = {
  title: "Audit log",
  robots: { index: false, follow: false },
};

export default function AuditLogPage() {
  return (
    <Suspense fallback={<AuditSkeleton />}>
      <AuditBody />
    </Suspense>
  );
}

async function AuditBody() {
  // The layout already gates /admin, but the page re-checks: a page that renders the audit trail
  // should not depend on a parent to be safe.
  await requireAdminViewer();

  // Rendered server-side so the operator sees history immediately, before the socket connects.
  const page = await listAuditLogPage({ pageSize: AUDIT_PAGE_SIZE });

  return (
    <AuditLogLive
      initialRows={page.entries.map(serialiseRow)}
      initialCursor={
        page.nextCursor
          ? {
              createdAt: page.nextCursor.createdAt.toISOString(),
              id: page.nextCursor.id,
            }
          : null
      }
      realtimeEnabled={isRealtimeConfigured()}
      publishableKey={clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}
    />
  );
}

/** Dates cross the server/client boundary as ISO strings. */
function serialiseRow(entry: Awaited<ReturnType<typeof listAuditLogPage>>["entries"][number]): AuditRow {
  return {
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    metadata: entry.metadata,
  };
}

function AuditSkeleton() {
  return <Skeleton className="h-96 rounded-xl" />;
}
