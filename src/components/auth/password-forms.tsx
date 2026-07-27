"use client";

import { forgotPasswordAction, resetPasswordAction } from "@/app/actions/auth";
import { Field } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ForgotPasswordForm() {
  const { formRef, formAction, pending, formError, fieldError, result } = useActionForm(
    forgotPasswordAction,
    { successToast: false, resetOnSuccess: true },
  );

  if (result?.ok) {
    return (
      <Alert variant="success">
        <AlertDescription>{result.message}</AlertDescription>
      </Alert>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field name="email" label="Email" error={fieldError("email")} required>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const { formRef, formAction, pending, formError, fieldError } = useActionForm(
    resetPasswordAction,
    { redirectTo: "/login" },
  );

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />

      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        name="password"
        label="New password"
        error={fieldError("password")}
        hint="At least 10 characters, including a number."
        required
      >
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Field
        name="confirmPassword"
        label="Confirm new password"
        error={fieldError("confirmPassword")}
        required
      >
        <Input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Updating..." : "Update password"}
      </Button>
    </form>
  );
}
