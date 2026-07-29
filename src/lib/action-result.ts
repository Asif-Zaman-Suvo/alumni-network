import type { z } from "zod";

/**
 * Shared shape for every Server Action so forms can render field errors uniformly instead of
 * each action inventing its own result type.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[]>;
      /** Optional structured payload (e.g. masked email when SSC matches an existing alum). */
      data?: T;
    };

export function actionOk(): ActionResult;
export function actionOk<T>(data: T, message?: string): ActionResult<T>;
export function actionOk<T>(data?: T, message?: string): ActionResult<T | undefined> {
  return { ok: true, data, message };
}

export function actionError(
  error: string,
  fieldErrors?: Record<string, string[]>,
): ActionResult<never>;
export function actionError<T>(
  error: string,
  fieldErrors: Record<string, string[]> | undefined,
  data: T,
): ActionResult<T>;
export function actionError<T>(
  error: string,
  fieldErrors?: Record<string, string[]>,
  data?: T,
): ActionResult<T> | ActionResult<never> {
  return {
    ok: false,
    error,
    ...(fieldErrors ? { fieldErrors } : {}),
    ...(data !== undefined ? { data } : {}),
  };
}

export function fromZodError(error: z.ZodError): ActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.join(".") || "_form";
    const existing = fieldErrors[key];
    if (existing) {
      existing.push(issue.message);
    } else {
      fieldErrors[key] = [issue.message];
    }
  }

  return actionError("Please correct the highlighted fields.", fieldErrors);
}

export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    result[key] = value;
  }

  return result;
}
