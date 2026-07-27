"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/admin", label: "Overview", exact: true },
  { href: "/admin/verifications", label: "Review queue", exact: false },
  { href: "/admin/users", label: "Users", exact: false },
  { href: "/admin/audit", label: "Audit log", exact: false },
] as const;

/** Prefetches sibling admin routes so tab switches reuse the warm RSC payload sooner. */
export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap gap-1 border-b border-border pb-2">
      {TABS.map((tab) => {
        const active = tab.exact
          ? pathname === tab.href
          : pathname === tab.href || pathname.startsWith(`${tab.href}/`);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            prefetch
            className={cn(
              buttonVariants({ variant: active ? "secondary" : "ghost", size: "sm" }),
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
