"use client";

import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { Field } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const { formRef, formAction, pending, formError, fieldError } = useActionForm(loginAction, {
    // The proxy re-routes based on verification status, so /directory is a safe default.
    redirectTo: callbackUrl ?? "/directory",
    successToast: false,
  });

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

      <Field name="password" label="Password" error={fieldError("password")} required>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <div className="flex items-center justify-between text-sm">
        <Link
          href="/forgot-password"
          className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          Forgot your password?
        </Link>
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Signing in..." : "Sign in"}
      </Button>
    </form>
  );
}
