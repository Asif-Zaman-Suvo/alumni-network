"use client";

import { GlobeIcon, ScanSearchIcon, ShieldCheckIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { HoverLift } from "@/components/motion/hover-lift";
import { Stagger, StaggerItem } from "@/components/motion/stagger";

const HIGHLIGHTS = [
  {
    icon: ShieldCheckIcon,
    title: "Verified by a human",
    description:
      "Every member submits their SSC roll and registration number, and an administrator checks it against school records before the account is activated.",
  },
  {
    icon: ScanSearchIcon,
    title: "Search that actually finds people",
    description:
      "Full-text and fuzzy name search across batches, departments, employers and cities — spelling variations included.",
  },
  {
    icon: GlobeIcon,
    title: "You control what is visible",
    description:
      "Choose whether your profile is public, members-only or hidden, and decide separately whether your email and employer are shown.",
  },
] as const;

export function LandingHighlights() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20" aria-labelledby="why-heading">
      <h2 id="why-heading" className="sr-only">
        Why this network
      </h2>
      <Stagger className="grid gap-4 sm:gap-6 md:grid-cols-3">
        {HIGHLIGHTS.map((item) => (
          <StaggerItem key={item.title}>
            <HoverLift>
              <Card className="h-full transition-shadow motion-safe:hover:shadow-md">
                <CardContent className="pt-6">
                  <span
                    className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary"
                    aria-hidden
                  >
                    <item.icon className="size-5" />
                  </span>
                  <h3 className="text-base font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {item.description}
                  </p>
                </CardContent>
              </Card>
            </HoverLift>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
