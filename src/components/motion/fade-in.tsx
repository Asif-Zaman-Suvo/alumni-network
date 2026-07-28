"use client";

import { motion, useReducedMotion, type HTMLMotionProps } from "motion/react";
import { cn } from "@/lib/utils";

type FadeInProps = HTMLMotionProps<"div"> & {
  /** Delay before enter, in seconds. */
  delay?: number;
  /** Vertical offset in px when motion is allowed. */
  y?: number;
  /** Once: animate only the first time it enters the viewport. */
  once?: boolean;
  amount?: number | "some" | "all";
  /** Skip scroll trigger — animate on mount (hero, above-the-fold). */
  immediate?: boolean;
};

/**
 * Scroll-triggered fade + slight rise. Instant/static when reduced motion is on.
 */
export function FadeIn({
  children,
  className,
  delay = 0,
  y = 16,
  once = true,
  amount = 0.2,
  immediate = false,
  ...props
}: FadeInProps) {
  const reduce = useReducedMotion();
  const hidden = reduce ? false : { opacity: 0, y };
  const shown = { opacity: 1, y: 0 };
  const transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const, delay };

  if (immediate) {
    return (
      <motion.div
        className={cn(className)}
        initial={hidden}
        animate={shown}
        transition={transition}
        {...props}
      >
        {children}
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn(className)}
      initial={hidden}
      whileInView={reduce ? undefined : shown}
      viewport={{ once, amount }}
      transition={transition}
      {...props}
    >
      {children}
    </motion.div>
  );
}
