"use client";

import { UsersIcon } from "lucide-react";
import { FadeIn } from "@/components/motion/fade-in";
import { Stagger, StaggerItem } from "@/components/motion/stagger";

const STEPS = [
  {
    step: "1",
    title: "Sign up",
    body: "Create an account with your email, or continue with Google.",
  },
  {
    step: "2",
    title: "Submit your SSC details",
    body: "Roll number, registration number and passing year. Attach your marksheet or certificate to speed things up.",
  },
  {
    step: "3",
    title: "An administrator reviews it",
    body: "You get an email as soon as a decision is made. Most requests are handled within a few days.",
  },
] as const;

export function LandingHowItWorks() {
  return (
    <section
      className="border-t border-border bg-muted/40"
      aria-labelledby="how-access-heading"
    >
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <FadeIn>
          <h2 id="how-access-heading" className="text-2xl font-semibold tracking-tight">
            How access works
          </h2>
        </FadeIn>

        <Stagger className="mt-8 grid gap-6 sm:grid-cols-3" role="list">
          {STEPS.map((item) => (
            <StaggerItem key={item.step} role="listitem" className="flex gap-4">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
                aria-hidden
              >
                {item.step}
              </span>
              <div>
                <h3 className="font-medium">
                  <span className="sr-only">Step {item.step}: </span>
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <FadeIn delay={0.15} className="mt-10 sm:mt-12">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 sm:items-center sm:p-5">
            <UsersIcon className="mt-0.5 size-5 shrink-0 text-primary sm:mt-0" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Are you a batch representative willing to help review requests for your year? Ask
              an administrator for moderator access.
            </p>
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
