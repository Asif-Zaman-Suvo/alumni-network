import type { MetadataRoute } from "next";
import { clientEnv } from "@/env";

/** Deliberately marketing-only. Member profiles must never appear in a sitemap. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: clientEnv.NEXT_PUBLIC_APP_URL,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
