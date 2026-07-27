import Link from "next/link";
import {
  ArrowRightIcon,
  GlobeIcon,
  ScanSearchIcon,
  ShieldCheckIcon,
  UsersIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { clientEnv } from "@/env";
import { getViewer } from "@/lib/dal/session";
import { getNetworkStats } from "@/lib/dal/profiles";

/** Marketing page: the only route in the app that should be indexable. */
export default async function LandingPage() {
  const [viewer, stats] = await Promise.all([getViewer(), getNetworkStats()]);
  const school = clientEnv.NEXT_PUBLIC_SCHOOL_NAME;

  const highlights = [
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
  ];

  return (
    <>
      <section className="relative overflow-hidden border-b border-border">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--color-primary)/10,transparent_60%)]" />
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <Badge variant="outline" className="mb-6">
              <ShieldCheckIcon />
              Verified alumni only
            </Badge>
            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Find the {school} graduates you lost touch with.
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              A directory of former students, kept trustworthy by manual verification. No
              open sign-ups, no scraped profiles, no strangers.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              {viewer?.isVerified ? (
                <Button size="lg" asChild>
                  <Link href="/directory">
                    Browse the directory
                    <ArrowRightIcon />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" asChild>
                    <Link href="/register">
                      Request access
                      <ArrowRightIcon />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/login">I already have an account</Link>
                  </Button>
                </>
              )}
            </div>
          </div>

          {stats.verifiedAlumni > 0 ? (
            <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-8 sm:grid-cols-3">
              <div>
                <dt className="text-sm text-muted-foreground">Verified alumni</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">
                  {stats.verifiedAlumni.toLocaleString()}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-muted-foreground">Countries</dt>
                <dd className="mt-1 text-3xl font-semibold tabular-nums">{stats.countries}</dd>
              </div>
              {stats.earliestYear && stats.latestYear ? (
                <div>
                  <dt className="text-sm text-muted-foreground">Batches</dt>
                  <dd className="mt-1 text-3xl font-semibold tabular-nums">
                    {stats.earliestYear}–{stats.latestYear}
                  </dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="grid gap-6 md:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title}>
              <CardContent className="pt-6">
                <span className="mb-4 flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <item.icon className="size-5" />
                </span>
                <h2 className="text-base font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-muted/40">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <h2 className="text-2xl font-semibold tracking-tight">How access works</h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {[
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
            ].map((item) => (
              <li key={item.step} className="flex gap-4">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                  {item.step}
                </span>
                <div>
                  <h3 className="font-medium">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{item.body}</p>
                </div>
              </li>
            ))}
          </ol>

          <div className="mt-12 flex items-center gap-3 rounded-xl border border-border bg-background p-5">
            <UsersIcon className="size-5 shrink-0 text-primary" />
            <p className="text-sm text-muted-foreground">
              Are you a batch representative willing to help review requests for your year?
              Ask an administrator for moderator access.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
