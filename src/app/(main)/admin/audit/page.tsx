import type { Metadata } from "next";
import { Suspense } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listAuditLog } from "@/lib/dal/admin";

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
  const entries = await listAuditLog(100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Audit log</CardTitle>
        <CardDescription>
          Append-only record of staff actions, written in the same transaction as the change
          itself. The 100 most recent entries.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Target</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                  Nothing recorded yet.
                </TableCell>
              </TableRow>
            ) : (
              entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(entry.createdAt, "d MMM yyyy, HH:mm")}
                  </TableCell>
                  <TableCell className="text-xs">{entry.actorEmail}</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        entry.action.includes("reject") || entry.action.includes("suspend")
                          ? "destructive"
                          : entry.action.includes("approve")
                            ? "success"
                            : "secondary"
                      }
                    >
                      {entry.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {entry.targetType}/{entry.targetId.slice(0, 10)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AuditSkeleton() {
  return <Skeleton className="h-96 rounded-xl" />;
}
