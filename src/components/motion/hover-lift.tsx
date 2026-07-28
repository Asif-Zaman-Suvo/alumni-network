"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type HoverLiftProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Subtle scale + shadow on hover for interactive cards. No-op under reduced motion.
 */
export function HoverLift({ children, className }: HoverLiftProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn("h-full", className)}
      whileHover={reduce ? undefined : { y: -2, transition: { duration: 0.18 } }}
      whileTap={reduce ? undefined : { scale: 0.995 }}
    >
      {children}
    </motion.div>
  );
}
