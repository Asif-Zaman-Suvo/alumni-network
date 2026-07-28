"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { SearchXIcon } from "lucide-react";
import { AlumniCard } from "@/components/directory/alumni-card";
import { Card, CardContent } from "@/components/ui/card";
import type { DirectoryEntry } from "@/lib/dal/profiles";
import { cn } from "@/lib/utils";

type DirectoryResultsProps = {
  entries: DirectoryEntry[];
  view: "grid" | "list";
  /** Stable key for the current filter set so AnimatePresence remounts on change. */
  resultsKey: string;
};

export function DirectoryResults({ entries, view, resultsKey }: DirectoryResultsProps) {
  const reduce = useReducedMotion();

  if (entries.length === 0) {
    return (
      <Card role="status">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <SearchXIcon className="size-8 text-muted-foreground" aria-hidden />
          <p className="font-medium">No alumni match those filters</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try a shorter search term, or widen the batch range. Members who set their profile
            to private do not appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={resultsKey}
        role="list"
        aria-label="Alumni results"
        className={cn(
          view === "grid"
            ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
            : "flex flex-col gap-3",
        )}
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduce ? undefined : { opacity: 0, y: -6 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
      >
        {entries.map((entry, index) => (
          <motion.div
            key={entry.slug}
            role="listitem"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              delay: reduce ? 0 : Math.min(index * 0.04, 0.32),
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <AlumniCard entry={entry} view={view} />
          </motion.div>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
