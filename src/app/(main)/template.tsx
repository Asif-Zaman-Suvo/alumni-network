"use client";

import { PageTransition } from "@/components/motion/page-transition";

/** Remounts on navigation so PageTransition can fade between routes. */
export default function MainTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
