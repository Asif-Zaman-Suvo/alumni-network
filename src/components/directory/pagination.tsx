import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PaginationProps = {
  page: number;
  totalPages: number;
  /** Current query string without `page`, so links preserve active filters. */
  baseParams: URLSearchParams;
  pathname: string;
};

/**
 * Offset pagination. At one school's scale (tens of thousands of profiles at most) the
 * OFFSET cost is irrelevant, and numbered pages are what people expect from a directory.
 */
export function Pagination({ page, totalPages, baseParams, pathname }: PaginationProps) {
  if (totalPages <= 1) return null;

  const href = (target: number) => {
    const params = new URLSearchParams(baseParams.toString());
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const windowSize = 2;
  const pages: Array<number | "gap"> = [];
  for (let candidate = 1; candidate <= totalPages; candidate += 1) {
    const nearCurrent = Math.abs(candidate - page) <= windowSize;
    const isEdge = candidate === 1 || candidate === totalPages;

    if (nearCurrent || isEdge) {
      pages.push(candidate);
    } else if (pages[pages.length - 1] !== "gap") {
      pages.push("gap");
    }
  }

  return (
    <nav className="flex items-center justify-center gap-1" aria-label="Pagination">
      {page > 1 ? (
        <Link
          href={href(page - 1)}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
          aria-label="Previous page"
        >
          <ChevronLeftIcon />
        </Link>
      ) : null}

      {pages.map((item, index) =>
        item === "gap" ? (
          <span key={`gap-${index}`} className="px-2 text-sm text-muted-foreground">
            ...
          </span>
        ) : (
          <Link
            key={item}
            href={href(item)}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              buttonVariants({ variant: item === page ? "default" : "ghost", size: "icon" }),
              "tabular-nums",
            )}
          >
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link
          href={href(page + 1)}
          className={cn(buttonVariants({ variant: "outline", size: "icon" }))}
          aria-label="Next page"
        >
          <ChevronRightIcon />
        </Link>
      ) : null}
    </nav>
  );
}
