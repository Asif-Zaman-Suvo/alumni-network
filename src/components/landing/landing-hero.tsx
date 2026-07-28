"use client";

import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowRightIcon, ShieldCheckIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CountUpStat } from "@/components/motion/count-up";
import { FadeIn } from "@/components/motion/fade-in";
import type { NetworkStats } from "@/lib/dal/profiles";

type LandingHeroProps = {
  school: string;
  isVerified: boolean;
  stats: NetworkStats;
};

export function LandingHero({ school, isVerified, stats }: LandingHeroProps) {
  const reduce = useReducedMotion();

  return (
    <section className="relative overflow-hidden border-b border-border">
      {/* Soft primary wash — uses token, not a purple gradient stack */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/8,transparent_55%)]"
        aria-hidden
      />

      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24 lg:py-28">
        <FadeIn immediate y={reduce ? 0 : 20}>
          <Badge variant="outline" className="mb-5 sm:mb-6">
            <ShieldCheckIcon aria-hidden />
            Verified alumni only
          </Badge>
        </FadeIn>

        <FadeIn immediate delay={0.06} y={reduce ? 0 : 22}>
          <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
            Find the {school} graduates you lost touch with.
          </h1>
        </FadeIn>

        <FadeIn immediate delay={0.12} y={reduce ? 0 : 18}>
          <p className="mt-4 max-w-xl text-base text-muted-foreground sm:mt-5 sm:text-lg">
            A directory of former students, kept trustworthy by manual verification. No open
            sign-ups, no scraped profiles, no strangers.
          </p>
        </FadeIn>

        <FadeIn immediate delay={0.18}>
          <div className="mt-7 flex flex-wrap gap-3 sm:mt-8">
            {isVerified ? (
              <Button
                size="lg"
                className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
                asChild
              >
                <Link href="/directory">
                  Browse the directory
                  <ArrowRightIcon aria-hidden />
                </Link>
              </Button>
            ) : (
              <>
                <Button
                  size="lg"
                  className="motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
                  asChild
                >
                  <Link href="/register">
                    Request access
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/login">I already have an account</Link>
                </Button>
              </>
            )}
          </div>
        </FadeIn>

        {stats.verifiedAlumni > 0 ? (
          <FadeIn immediate delay={0.24} className="mt-12 sm:mt-16">
            <dl
              className="grid max-w-2xl grid-cols-2 gap-6 sm:grid-cols-3 sm:gap-8"
              aria-label="Network snapshot"
            >
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
        ) : null}
      </div>
    </section>
  );
}
