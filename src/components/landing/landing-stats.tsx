"use client";

import { CountUpStat } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import type { NetworkStats } from "@/lib/dal/profiles";

export function LandingStats({ stats }: { stats: NetworkStats }) {
  if (stats.verifiedAlumni <= 0) return null;

  return (
    <section
      className="border-b border-border bg-background"
      aria-labelledby="network-stats-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <FadeIn>
          <h2 id="network-stats-heading" className="sr-only">
            Network snapshot
          </h2>
          <dl className="grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8">
            <CountUpStat value={stats.verifiedAlumni} label="Verified alumni" />
            <CountUpStat value={stats.countries} label="Countries" />
            {stats.earliestYear && stats.latestYear ? (
              <div className="col-span-2 sm:col-span-1">
                <dt className="text-sm text-muted-foreground">Batches</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {stats.earliestYear}–{stats.latestYear}
                </dd>
              </div>
            ) : null}
          </dl>
        </FadeIn>
      </div>
    </section>
  );
}
