"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const INTERVAL_MS = 5_000;

/**
 * Admin approval cannot write this browser's JWT. Refresh the RSC tree so
 * requireViewerWithFreshStatus can see the new status and bounce to session/sync.
 */
export function StatusRefresh() {
  const router = useRouter();

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "hidden") return;
      router.refresh();
    };
    const id = window.setInterval(tick, INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [router]);

  return null;
}
