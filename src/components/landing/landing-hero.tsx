"use client";

import Image from "next/image";
import Link from "next/link";
import { useReducedMotion } from "motion/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/fade-in";

type LandingHeroProps = {
  school: string;
  isVerified: boolean;
};

/**
 * Full-bleed campus hero. Brand is the primary signal; one headline, one line of support,
 * one CTA group. Stats live in the next section so the first viewport stays uncluttered.
 */
export function LandingHero({ school, isVerified }: LandingHeroProps) {
  const reduce = useReducedMotion();

  return (
    <section className="relative isolate min-h-[min(88dvh,52rem)] overflow-hidden">
      <Image
        src="/images/campus.jpg"
        alt={`${school} campus building`}
        fill
        priority
        sizes="100vw"
        className="object-cover object-[center_35%]"
      />

      {/* Readable scrim — warm dark from left/bottom, not a purple wash */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/55 to-black/25"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-black/20"
        aria-hidden
      />

      <div className="relative mx-auto flex min-h-[min(88dvh,52rem)] max-w-6xl flex-col justify-end px-4 pb-14 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
        <FadeIn immediate y={reduce ? 0 : 18}>
          <p className="text-sm font-medium tracking-wide text-white/85 sm:text-base">
            {school} Alumni
          </p>
        </FadeIn>

        <FadeIn immediate delay={0.06} y={reduce ? 0 : 22}>
          <h1 className="mt-3 max-w-2xl text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl lg:text-5xl">
            Find the classmates you lost touch with.
          </h1>
        </FadeIn>

        <FadeIn immediate delay={0.12} y={reduce ? 0 : 16}>
          <p className="mt-4 max-w-lg text-base text-white/80 sm:text-lg">
            A verified directory of former students — no open sign-ups, no scraped profiles.
          </p>
        </FadeIn>

        <FadeIn immediate delay={0.18}>
          <div className="mt-8 flex flex-wrap gap-3">
            {isVerified ? (
              <Button
                size="lg"
                className="bg-white text-foreground hover:bg-white/90 motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
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
                  className="bg-white text-foreground hover:bg-white/90 motion-safe:transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.98]"
                  asChild
                >
                  <Link href="/register">
                    Request access
                    <ArrowRightIcon aria-hidden />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
                  asChild
                >
                  <Link href="/login">I already have an account</Link>
                </Button>
              </>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
