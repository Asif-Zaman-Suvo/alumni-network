import Link from "next/link";
import { GraduationCapIcon, ShieldCheckIcon } from "lucide-react";
import { UserMenu } from "@/components/layout/user-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clientEnv } from "@/env";
import { getViewer } from "@/lib/dal/session";

export async function SiteHeader() {
  const viewer = await getViewer();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href={viewer?.isVerified ? "/directory" : "/"} className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCapIcon className="size-4" />
          </span>
          <span className="hidden text-sm font-semibold sm:block">
            {clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni
          </span>
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {viewer?.isVerified ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/directory">Directory</Link>
            </Button>
          ) : null}

          {viewer?.isStaff ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <ShieldCheckIcon />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          ) : null}

          {viewer ? (
            <UserMenu
              name={viewer.name ?? viewer.email}
              email={viewer.email}
              image={viewer.image}
              isVerified={viewer.isVerified}
            />
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button size="sm" asChild>
                <Link href="/register">Request access</Link>
              </Button>
            </>
          )}
        </nav>
      </div>

      {viewer && !viewer.isVerified ? (
        <div className="border-t border-border bg-warning/10 px-4 py-2 text-center text-xs sm:px-6">
          <Badge variant="warning">
            {viewer.status === "UNVERIFIED" ? "Details needed" : "Awaiting review"}
          </Badge>
          <span className="ml-2 text-muted-foreground">
            The directory unlocks once an administrator confirms your SSC details.
          </span>
        </div>
      ) : null}
    </header>
  );
}
