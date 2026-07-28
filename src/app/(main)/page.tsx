import { LandingHero } from "@/components/landing/landing-hero";
import { LandingHighlights } from "@/components/landing/landing-highlights";
import { LandingHowItWorks } from "@/components/landing/landing-how-it-works";
import { clientEnv } from "@/env";
import { getViewer } from "@/lib/dal/session";
import { getNetworkStats } from "@/lib/dal/profiles";

/** Marketing page: the only route in the app that should be indexable. */
export default async function LandingPage() {
  const [viewer, stats] = await Promise.all([getViewer(), getNetworkStats()]);
  const school = clientEnv.NEXT_PUBLIC_SCHOOL_NAME;

  return (
    <>
      <LandingHero
        school={school}
        isVerified={Boolean(viewer?.isVerified)}
        stats={stats}
      />
      <LandingHighlights />
      <LandingHowItWorks />
    </>
  );
}
