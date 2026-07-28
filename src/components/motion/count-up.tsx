"use client";

import { useEffect, useRef, useState } from "react";
import { useInView, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

type CountUpProps = {
  value: number;
  label: string;
  className?: string;
  format?: boolean;
  suffix?: string;
  durationMs?: number;
};

/**
 * Scroll-triggered count-up. Jumps to the final value when reduced motion is preferred.
 */
export function CountUpStat({
  value,
  label,
  className,
  format = true,
  suffix = "",
  durationMs = 900,
}: CountUpProps) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.55 });
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;

    if (reduce || value <= 0) {
      setDisplay(value);
      return;
    }

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease-out cubic — institutional, not bouncy.
      const eased = 1 - (1 - t) ** 3;
      setDisplay(Math.round(value * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, reduce, durationMs]);

  const text = format ? display.toLocaleString() : String(display);

  return (
    <div ref={ref} className={cn(className)}>
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-3xl font-semibold tabular-nums">
        <span aria-hidden="true">
          {text}
          {suffix}
        </span>
        <span className="sr-only">
          {format ? value.toLocaleString() : value}
          {suffix}
        </span>
      </dd>
    </div>
  );
}
