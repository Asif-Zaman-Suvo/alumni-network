import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchXIcon } from "lucide-react";
import { AlumniCard } from "@/components/directory/alumni-card";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { Pagination } from "@/components/directory/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DEFAULT_PAGE_SIZE,
  getDirectoryFilterOptions,
  searchDirectory,
  type DirectorySort,
} from "@/lib/dal/profiles";
import { requireVerifiedViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Alumni directory",
  // Member data must never reach a search index, regardless of individual privacy settings.
  robots: { index: false, follow: false },
};

type SearchParams = {
  q?: string;
  department?: string;
  yearFrom?: string;
  yearTo?: string;
  country?: string;
  sort?: string;
  view?: string;
  page?: string;
};

const SORTS = new Set<DirectorySort>(["relevance", "name", "recent", "year"]);

function parseYear(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export default async function DirectoryPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  // Redirects PENDING and REJECTED users; the DAL independently returns nothing for them.
  // getViewer is React.cache'd — header + this gate + DAL share one auth() per request.
  await requireVerifiedViewer();

  const searchParams = await props.searchParams;
  const sort = SORTS.has(searchParams.sort as DirectorySort)
    ? (searchParams.sort as DirectorySort)
    : undefined;

  // Was sequential (facets → search). Facets are cached; search is the only cold path.
  // Running both together removes the waterfall when the filter-options cache is cold.
  const [filterOptions, result] = await Promise.all([
    getDirectoryFilterOptions(),
    searchDirectory({
      q: searchParams.q,
      departmentId: searchParams.department,
      yearFrom: parseYear(searchParams.yearFrom),
      yearTo: parseYear(searchParams.yearTo),
      countryCode: searchParams.country,
      sort,
      page: parseYear(searchParams.page) ?? 1,
      pageSize: DEFAULT_PAGE_SIZE,
    }),
  ]);

  const view = searchParams.view === "list" ? "list" : "grid";

  const baseParams = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (value && key !== "page") baseParams.set(key, value);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Alumni directory</h1>
        <p className="text-sm text-muted-foreground">
          {result.total.toLocaleString()} verified{" "}
          {result.total === 1 ? "member" : "members"}
          {result.totalPages > 1 ? ` · page ${result.page} of ${result.totalPages}` : ""}
        </p>
      </header>

      <Suspense fallback={<FiltersSkeleton />}>
        <DirectoryFilters
          options={{
            departments: filterOptions.departments,
            years: filterOptions.years,
            countries: filterOptions.countries,
          }}
        />
      </Suspense>

      {result.entries.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
            <SearchXIcon className="size-8 text-muted-foreground" />
            <p className="font-medium">No alumni match those filters</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Try a shorter search term, or widen the batch range. Members who set their
              profile to private do not appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div
          className={
            view === "grid"
              ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              : "flex flex-col gap-3"
          }
        >
          {result.entries.map((entry) => (
            <AlumniCard key={entry.slug} entry={entry} view={view} />
          ))}
        </div>
      )}

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        baseParams={baseParams}
        pathname="/directory"
      />
    </div>
  );
}

function FiltersSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
    </div>
  );
}
