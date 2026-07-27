"use client";

import * as React from "react";
import { CheckCircle2Icon, InfoIcon, TriangleAlertIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

type Toast = {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
};

type Listener = (toast: Toast) => void;

const listeners = new Set<Listener>();
let nextId = 0;

/**
 * Module-level emitter rather than context, so any client component can fire a toast
 * after a Server Action resolves without threading a provider through the tree.
 */
export function toast(input: { title: string; description?: string; variant?: ToastVariant }) {
  const payload: Toast = {
    id: nextId++,
    title: input.title,
    description: input.description,
    variant: input.variant ?? "info",
  };
  listeners.forEach((listener) => listener(payload));
}

const VARIANT_STYLES: Record<ToastVariant, { icon: React.ElementType; className: string }> = {
  success: { icon: CheckCircle2Icon, className: "border-success/30 text-success" },
  error: { icon: TriangleAlertIcon, className: "border-destructive/30 text-destructive" },
  info: { icon: InfoIcon, className: "border-primary/30 text-primary" },
};

const DISMISS_AFTER_MS = 6000;

export function Toaster() {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  React.useEffect(() => {
    const listener: Listener = (incoming) => {
      setToasts((current) => [...current, incoming]);
      window.setTimeout(() => {
        setToasts((current) => current.filter((item) => item.id !== incoming.id));
      }, DISMISS_AFTER_MS);
    };

    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-100 flex w-full max-w-sm flex-col gap-2"
    >
      {toasts.map((item) => {
        const { icon: Icon, className } = VARIANT_STYLES[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border bg-card p-4 shadow-lg",
              className,
            )}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium text-card-foreground">{item.title}</p>
              {item.description ? (
                <p className="text-sm text-muted-foreground">{item.description}</p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <XIcon className="size-4" />
              <span className="sr-only">Dismiss</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
