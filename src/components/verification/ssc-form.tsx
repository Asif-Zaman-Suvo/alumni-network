"use client";

import * as React from "react";
import { PaperclipIcon } from "lucide-react";
import { submitVerificationAction } from "@/app/actions/verification";
import { Field } from "@/components/forms/field";
import { useActionForm } from "@/components/forms/use-action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EARLIEST_PASSING_YEAR, LATEST_PASSING_YEAR } from "@/lib/validation";

type SscFormProps = {
  defaultName?: string;
  attemptsRemaining: number;
};

export function SscForm({ defaultName, attemptsRemaining }: SscFormProps) {
  const [fileName, setFileName] = React.useState<string | null>(null);
  const { formRef, formAction, pending, formError, fieldError } = useActionForm(
    submitVerificationAction,
    { redirectTo: "/verification-status" },
  );

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
