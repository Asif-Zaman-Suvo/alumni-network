import { AdminNav } from "@/components/admin/admin-nav";
import { Badge } from "@/components/ui/badge";
import { requireStaffViewer } from "@/lib/dal/session";

/**
 * Role is asserted here as well as in the proxy. The layout guard is what makes a missed
 * proxy matcher a non-event rather than a data leak.
 *
 * Children are intentionally NOT awaited here — each page wraps its data fetch in
 * Suspense so the chrome (title + tabs) streams first while queries run.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireStaffViewer();

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-10 sm:px-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Administration</h1>
          <Badge variant={viewer.role === "ADMIN" ? "default" : "secondary"}>
            {viewer.role.toLowerCase()}
          </Badge>
        </div>
        <AdminNav />
      </header>

      {children}
    </div>
  );
}
