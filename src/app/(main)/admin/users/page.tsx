import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { format } from "date-fns";
import { UsersIcon } from "lucide-react";
import { UserRowActions } from "@/components/admin/user-row-actions";
import { Pagination } from "@/components/directory/pagination";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { listUsers } from "@/lib/dal/admin";
import { requireAdminViewer } from "@/lib/dal/session";
import { cn } from "@/lib/utils";
import type { Role, UserStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Users",
  robots: { index: false, follow: false },
};

type SearchParams = { q?: string; status?: string; role?: string; page?: string };

const STATUSES: UserStatus[] = ["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"];
const ROLES: Role[] = ["ALUMNI", "ADMIN"];

const STATUS_VARIANT: Record<UserStatus, "success" | "warning" | "destructive" | "secondary"> = {
  VERIFIED: "success",
  PENDING: "warning",
  REJECTED: "destructive",
  UNVERIFIED: "secondary",
};

/**
 * Filter UX: native GET form. Changing inputs does nothing until "Filter" is clicked
 * (or Enter in the search field). That navigates to /admin/users?q=&status=&role=.
 */
export default async function AdminUsersPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const suspenseKey = new URLSearchParams(
    Object.entries(searchParams).filter((entry): entry is [string, string] => Boolean(entry[1])),
  ).toString();

  return (
    <div className="space-y-6">
      <form method="get" action="/admin/users" className="flex flex-wrap gap-2">
        <input
          name="q"
          defaultValue={searchParams.q ?? ""}
          placeholder="Search name or email"
          className="h-9 min-w-56 flex-1 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <select
          name="status"
          defaultValue={searchParams.status ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
        >
          <option value="">Any status</option>
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {status.toLowerCase()}
            </option>
          ))}
        </select>
        <select
          name="role"
          defaultValue={searchParams.role ?? ""}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm shadow-sm"
        >
          <option value="">Any role</option>
          {ROLES.map((role) => (
            <option key={role} value={role}>
              {role.toLowerCase()}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className={cn(buttonVariants({ variant: "outline" }), "h-9 px-4")}
        >
          Filter
        </button>
        {suspenseKey ? (
          <Link
            href="/admin/users"
            className={cn(buttonVariants({ variant: "ghost" }), "h-9 px-4")}
          >
            Clear
          </Link>
        ) : null}
      </form>

      <Suspense key={suspenseKey || "all"} fallback={<UsersSkeleton />}>
        <UsersTable searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function UsersTable({ searchParams }: { searchParams: SearchParams }) {
  const viewer = await requireAdminViewer();

  const page = Number.parseInt(searchParams.page ?? "1", 10) || 1;
  const result = await listUsers({
    q: searchParams.q,
    status: STATUSES.includes(searchParams.status as UserStatus)
      ? (searchParams.status as UserStatus)
      : undefined,
    role: ROLES.includes(searchParams.role as Role) ? (searchParams.role as Role) : undefined,
    page,
  });

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") baseParams.set(key, value);
  }

  if (result.users.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <UsersIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">No users match those filters</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Clear the search or widen status/role, then click Filter again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <p className="text-sm text-muted-foreground">
        {result.total.toLocaleString()} {result.total === 1 ? "user" : "users"}
        {result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
      </p>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Batch</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.users.map((user) => (
                <TableRow key={user.id} className={user.deletedAt ? "opacity-60" : ""}>
                  <TableCell>
                    <div className="min-w-0">
                      {user.slug ? (
                        <Link
                          href={`/profile/${user.slug}`}
                          className="font-medium hover:underline"
                        >
                          {user.displayName ?? user.email}
                        </Link>
                      ) : (
                        <span className="font-medium">{user.displayName ?? "—"}</span>
                      )}
                      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={STATUS_VARIANT[user.status]}>
                        {user.status.toLowerCase()}
                      </Badge>
                      {user.deletedAt ? <Badge variant="outline">suspended</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{user.graduationYear ?? "—"}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(user.createdAt), "d MMM yyyy")}
                  </TableCell>
                  <TableCell>
                    <UserRowActions
                      userId={user.id}
                      role={user.role}
                      suspended={user.deletedAt !== null}
                      isSelf={user.id === viewer.id}
                      canManage={viewer.role === "ADMIN"}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        baseParams={baseParams}
        pathname="/admin/users"
      />
    </>
  );
}

function UsersSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
