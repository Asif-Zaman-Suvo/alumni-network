"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/action-result";
import { toast } from "@/components/ui/toaster";

type ServerAction<T> = (formData: FormData) => Promise<ActionResult<T>>;

type Options = {
  /** Navigated to on success, after the toast fires. */
  redirectTo?: string;
  successToast?: boolean;
  onSuccess?: () => void;
  resetOnSuccess?: boolean;
};

/**
 * Wraps a Server Action in `useActionState` so every form gets identical pending state,
 * field-level errors and success handling. Using a form `action` (rather than onSubmit)
 * keeps the forms working before hydration.
 */
export function useActionForm<T>(action: ServerAction<T>, options: Options = {}) {
  const router = useRouter();
  const formRef = React.useRef<HTMLFormElement>(null);
  const { redirectTo, successToast = true, onSuccess, resetOnSuccess } = options;

  const [state, formAction, pending] = React.useActionState<ActionResult<T> | null, FormData>(
    async (_previous, formData) => action(formData),
    null,
  );

  React.useEffect(() => {
    if (!state) return;

    if (state.ok) {
      if (successToast && state.message) {
        toast({ title: state.message, variant: "success" });
      }
      if (resetOnSuccess) formRef.current?.reset();
      onSuccess?.();
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      } else {
        router.refresh();
      }
    } else if (!state.fieldErrors) {
      toast({ title: state.error, variant: "error" });
    }
  }, [state, redirectTo, router, successToast, onSuccess, resetOnSuccess]);

  const fieldError = React.useCallback(
    (name: string): string | undefined =>
      state && !state.ok ? state.fieldErrors?.[name]?.[0] : undefined,
    [state],
  );

  return {
    formRef,
    formAction,
    pending,
    formError: state && !state.ok && !state.fieldErrors ? state.error : undefined,
    fieldErrorSummary: state && !state.ok ? state.error : undefined,
    fieldError,
    result: state,
  };
}
