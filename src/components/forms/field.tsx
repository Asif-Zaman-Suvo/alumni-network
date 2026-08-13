import * as React from "react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  name: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
};

export function Field({
  name,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errorId = error ? `${name}-error` : undefined;

  return (
    <div className={cn("space-y-1.5", className)}>
      {/*
       * The required marker sits beside the label rather than inside it, so the label's text is
       * exactly the field name. Nesting it made every accessible name "Label*", which both reads
       * badly in a screen reader and breaks any query that looks a field up by its label. The
       * input's own `required` attribute is what actually conveys the constraint, so the asterisk
       * is decoration and is hidden from assistive technology.
       */}
      <div className="flex items-center gap-0.5">
        <Label htmlFor={name}>{label}</Label>
        {required ? (
          <span aria-hidden="true" className="text-destructive">
            *
          </span>
        ) : null}
      </div>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}