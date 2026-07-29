"use client";

import * as React from "react";
import Link from "next/link";
import { PaperclipIcon } from "lucide-react";
import {
  submitVerificationAction,
  type VerificationSubmitData,
} from "@/app/actions/verification";
import { Field } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR } from "@/lib/validation";

type SscFormProps = {
  defaultName?: string;
  attemptsRemaining: number;
};

export function SscForm({ defaultName, attemptsRemaining }: SscFormProps) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const { formRef, formAction, pending, formError, fieldError, result } = useActionForm(
    submitVerificationAction,
    { successToast: true },
  );

  const existingAccount =
    result && !result.ok
      ? (result.data as VerificationSubmitData | undefined)?.existingAccount
      : undefined;

  if (existingAccount) {
    return (
      <div className="space-y-5">
        <Alert variant="destructive">
          <AlertTitle>Account already registered</AlertTitle>
          <AlertDescription>
            We found an existing account associated with this alumni record. Please sign in
            using the email address below instead. Do not create another account.
          </AlertDescription>
        </Alert>

        <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">
          <p className="text-muted-foreground">Registered email</p>
          <p className="mt-1 font-medium tracking-wide">{existingAccount.maskedEmail}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            The full address is hidden for privacy. Use the account you originally registered
            with
            {existingAccount.hasPassword
              ? " (email and password, or Google if you linked it from settings)."
              : " (Continue with Google if that is how you registered)."}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/login">Continue to login</Link>
          </Button>
          {existingAccount.hasPassword ? (
            <Button variant="outline" asChild>
              <Link href="/forgot-password">Forgot password?</Link>
            </Button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-5">
      {formError ? (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      ) : null}

      <Field
        name="fullNameOnCert"
        label="Full name as printed on your certificate"
        error={fieldError("fullNameOnCert")}
        required
      >
        <Input
          id="fullNameOnCert"
          name="fullNameOnCert"
          defaultValue={defaultName}
          autoComplete="name"
          required
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="sscRoll" label="SSC roll number" error={fieldError("sscRoll")} required>
          <Input id="sscRoll" name="sscRoll" inputMode="numeric" required placeholder="123456" />
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
          min={EARLIEST_PASSING_YEAR}
          max={LATEST_PASSING_YEAR}
          inputMode="numeric"
          required
          placeholder={String(LATEST_PASSING_YEAR)}
        />
      </Field>

      <Field
        name="document"
        label="Marksheet or certificate"
        error={fieldError("document")}
        hint="Strongly recommended. Without it, a reviewer has nothing to check your numbers against and your request will take longer. JPG, PNG, WebP or PDF, up to 5 MB."
      >
        <label
          htmlFor="document"
          className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-input px-4 py-4 text-sm transition-colors hover:border-primary hover:bg-accent/40"
        >
          <PaperclipIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className={fileName ? "font-medium" : "text-muted-foreground"}>
            {fileName ?? "Choose a file"}
          </span>
          <input
            id="document"
            name="document"
            type="file"
            accept="image/jpeg,image/png,image/webp,application/pdf"
            className="sr-only"
            onChange={(event) => setFileName(event.target.files?.[0]?.name ?? null)}
          />
        </label>
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Submitting..." : "Submit for review"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {attemptsRemaining} of 3 submission attempts remaining.
        </p>
      </div>
    </form>
  );
}
