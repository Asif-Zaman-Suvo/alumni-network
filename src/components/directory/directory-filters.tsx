"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGridIcon, ListIcon, SearchIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

type FilterOptions = {
  departments: Array<{ id: string; name: string }>;
  years: number[];
  countries: Array<{ code: string; count: number }>;
};

const ANY = "__any__";
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Filter state lives entirely in the URL. There is no client store: the page is a Server
 * Component, so a query change is a navigation and the result is server-rendered, shareable
 * and back-button friendly.
 */
export function DirectoryFilters({ options }: { options: FilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentQuery = searchParams.get("q") ?? "";
  const [term, setTerm] = React.useState(currentQuery);
  const [syncedQuery, setSyncedQuery] = React.useState(currentQuery);

  // Adjust during render rather than in an effect: navigation (back button, clear filters)
  // changes the URL, and the input has to follow without an extra commit.
  if (syncedQuery !== currentQuery) {
    setSyncedQuery(currentQuery);
    setTerm(currentQuery);
  }

  const push = React.useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      // Any filter change invalidates the current page number.
      params.delete("page");
      const query = params.toString();
      router.push(query ? `${pathname}?${query}` : pathname);
    },
    [pathname, router, searchParams],
  );

  React.useEffect(() => {
    if (term === currentQuery) return;

    const timer = window.setTimeout(() => {
      push((params) => {
        if (term.trim()) params.set("q", term.trim());
        else params.delete("q");
      });
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [term, currentQuery, push]);

  const setParam = (key: string, value: string) => {
    push((params) => {
      if (value && value !== ANY) params.set(key, value);
      else params.delete(key);
    });
  };

  const view = searchParams.get("view") === "list" ? "list" : "grid";
  const activeFilterCount = ["q", "department", "yearFrom", "yearTo", "country"].filter((key) =>
    searchParams.get(key),
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Search by name, employer, role or city"
            className="pl-9"
            aria-label="Search alumni"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={searchParams.get("sort") ?? (currentQuery ? "relevance" : "name")}
            onValueChange={(value) => setParam("sort", value)}
          >
            <SelectTrigger className="w-40" aria-label="Sort by">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="relevance">Best match</SelectItem>
              <SelectItem value="name">Name A–Z</SelectItem>
              <SelectItem value="year">Newest batch</SelectItem>
              <SelectItem value="recent">Recently joined</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex rounded-md border border-input p-0.5">
            {(["grid", "list"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setParam("view", mode === "grid" ? "" : mode)}
                aria-label={`${mode} view`}
                aria-pressed={view === mode}
                className={cn(
                  "rounded px-2 py-1 transition-colors",
                  view === mode
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {mode === "grid" ? (
                  <LayoutGridIcon className="size-4" />
                ) : (
                  <ListIcon className="size-4" />
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Department</Label>
          <Select
            value={searchParams.get("department") ?? ANY}
            onValueChange={(value) => setParam("department", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any department" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any department</SelectItem>
              {options.departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Batch from</Label>
          <Select
            value={searchParams.get("yearFrom") ?? ANY}
            onValueChange={(value) => setParam("yearFrom", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any year</SelectItem>
              {options.years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Batch to</Label>
          <Select
            value={searchParams.get("yearTo") ?? ANY}
            onValueChange={(value) => setParam("yearTo", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Any year" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any year</SelectItem>
              {options.years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Country</Label>
          <Select
            value={searchParams.get("country") ?? ANY}
            onValueChange={(value) => setParam("country", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Anywhere" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Anywhere</SelectItem>
              {options.countries.map((country) => (
                <SelectItem key={country.code} value={country.code}>
                  {countryName(country.code)} ({country.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {activeFilterCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(pathname)}
          className="text-muted-foreground"
        >
          <XIcon />
          Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
        </Button>
      ) : null}
    </div>
  );
}
