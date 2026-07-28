"use client";

import { MotionConfig } from "motion/react";

/**
 * Applies Framer Motion's `reducedMotion="user"` so every descendant animation
 * collapses to an instant/opacity-only change when the OS prefers reduced motion.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
