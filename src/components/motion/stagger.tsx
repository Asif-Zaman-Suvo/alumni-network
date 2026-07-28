"use client";

import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type StaggerProps = {
  children: React.ReactNode;
  className?: string;
  /** Stagger between children, seconds. */
  stagger?: number;
  once?: boolean;
  role?: React.AriaRole;
};

/**
 * Parent that staggers FadeIn-style children via `variants`. Pass `StaggerItem` as children.
 */
export function Stagger({
  children,
  className,
  stagger = 0.08,
  once = true,
  role,
}: StaggerProps) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      role={role}
      initial={reduce ? false : "hidden"}
      whileInView={reduce ? undefined : "show"}
      viewport={{ once, amount: 0.15 }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: reduce ? 0 : stagger },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
  role,
}: {
  children: React.ReactNode;
  className?: string;
  role?: React.AriaRole;
}) {
  const reduce = useReducedMotion();

  return (
    <motion.div
      className={cn(className)}
      role={role}
      variants={
        reduce
          ? undefined
          : {
              hidden: { opacity: 0, y: 14 },
              show: {
                opacity: 1,
                y: 0,
                transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
              },
            }
      }
    >
      {children}
    </motion.div>
  );
}
