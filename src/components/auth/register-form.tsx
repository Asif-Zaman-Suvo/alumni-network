"use client";

import { registerAction } from "@/app/actions/auth";
import { Field } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Separator } from "@/components/ui/separator";
import { EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR } from "@/lib/validation";

/**
 * Single form covering account details and the SSC claim. Splitting them across two screens
 * would leave accounts stranded in UNVERIFIED if the user abandoned step two.
 */
export function RegisterForm() {
  const { formRef, formAction, pending, formError, fieldError } = useActionForm(registerAction, {
    redirectTo: "/verification-status",
  });

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-4">
        <Field name="fullName" label="Full name" error={fieldError("fullName")} required>
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            placeholder="As printed on your certificate"
          />
        </Field>

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

        <Field
          name="password"
          label="Password"
          error={fieldError("password")}
          hint="At least 10 characters, including a number."
          required
        >
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            required
          />
        </Field>
      </div>

      <div className="space-y-1">
        <Separator />
        <p className="pt-4 text-sm font-medium">Prove you studied here</p>
        <p className="text-sm text-muted-foreground">
          An administrator checks these against school records before your account is
          activated. They are never shown to other alumni.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="sscRoll" label="SSC roll number" error={fieldError("sscRoll")} required>
          <Input
            id="sscRoll"
            name="sscRoll"
            inputMode="numeric"
            required
            placeholder="123456"
          />
        </Field>

        <Field
          name="sscRegistration"
          label="SSC registration number"
          error={fieldError("sscRegistration")}
          required
        >
          <Input
            id="sscRegistration"
            name="sscRegistration"
            inputMode="numeric"
            required
            placeholder="1234567890"
          />
        </Field>
      </div>

      <Field
        name="passingYear"
        label="Passing year"
        error={fieldError("passingYear")}
        required
        className="sm:max-w-48"
      >
        <Input
          id="passingYear"
          name="passingYear"
          type="number"
          inputMode="numeric"
          min={EARLIEST_PASSING_YEAR}
          max={LATEST_PASSING_YEAR}
          required
          placeholder={String(LATEST_PASSING_YEAR)}
        />
      </Field>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Creating account..." : "Create account"}
      </Button>
    </form>
  );
}
