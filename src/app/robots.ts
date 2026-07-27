import type { MetadataRoute } from "next";
import { clientEnv } from "@/env";

/**
 * Only the marketing page is crawlable. Alumni data (directory, profiles, admin) is
 * disallowed here and additionally sends X-Robots-Tag: noindex from next.config.ts.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/directory",
          "/profile/",
          "/admin",
          "/settings",
          "/onboarding",
          "/verification-status",
          "/login",
          "/register",
          "/api/",
        ],
      },
    ],
    sitemap: `${clientEnv.NEXT_PUBLIC_APP_URL}/sitemap.xml`,
  };
}
