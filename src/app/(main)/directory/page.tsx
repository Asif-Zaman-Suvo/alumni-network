import type { Metadata } from "next";
import { Suspense } from "react";
import { DirectoryFilters } from "@/components/directory/directory-filters";
import { DirectoryResults } from "@/components/directory/directory-results";
import { Pagination } from "@/components/directory/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { isBloodGroup } from "@/lib/blood-group";
import {
  DEFAULT_PAGE_SIZE,
  getDirectoryFilterOptions,
  searchDirectory,
  type DirectorySort,
} from "@/lib/dal/profiles";
import { requireDirectoryAccess } from "@/lib/dal/session";

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
  bloodGroup?: string;
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
  await requireDirectoryAccess();

  const searchParams = await props.searchParams;
  const sort = SORTS.has(searchParams.sort as DirectorySort)
    ? (searchParams.sort as DirectorySort)
    : undefined;

  const bloodGroup = searchParams.bloodGroup && isBloodGroup(searchParams.bloodGroup)
    ? searchParams.bloodGroup
    : undefined;

  const [filterOptions, result] = await Promise.all([
    getDirectoryFilterOptions(),
    searchDirectory({
      q: searchParams.q,
      departmentId: searchParams.department,
      yearFrom: parseYear(searchParams.yearFrom),
      yearTo: parseYear(searchParams.yearTo),
      countryCode: searchParams.country,
      bloodGroup,
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

  const resultsKey = [
    searchParams.q ?? "",
    searchParams.department ?? "",
    searchParams.yearFrom ?? "",
    searchParams.yearTo ?? "",
    searchParams.country ?? "",
    searchParams.bloodGroup ?? "",
    searchParams.sort ?? "",
    searchParams.view ?? "grid",
    searchParams.page ?? "1",
  ].join("|");

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Alumni directory</h1>
        <p className="text-sm text-muted-foreground" aria-live="polite">
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

      <Suspense fallback={<ResultsSkeleton view={view} />}>
        <DirectoryResults entries={result.entries} view={view} resultsKey={resultsKey} />
      </Suspense>

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
    <div className="space-y-4" aria-busy="true" aria-label="Loading filters">
      <Skeleton className="h-9 w-full" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-9" />
        ))}
      </div>
    </div>
  );
}

function ResultsSkeleton({ view }: { view: "grid" | "list" }) {
  return (
    <div
      className={
        view === "grid"
          ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          : "flex flex-col gap-3"
      }
      aria-busy="true"
      aria-label="Loading alumni"
    >
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="space-y-3 rounded-xl border border-border p-6">
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
    </div>
  );
}
