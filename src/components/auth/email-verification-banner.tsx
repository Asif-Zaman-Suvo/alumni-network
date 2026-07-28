"use client";

import { useTransition } from "react";
import { requestEmailVerificationAction } from "@/app/actions/auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toaster";

export function EmailVerificationBanner({ email }: { email: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <Alert variant="warning">
      <AlertTitle>Email not verified</AlertTitle>
      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Confirm <strong>{email}</strong> so we can reach you about your account. You can
          still use the app while this is pending.
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 bg-background"
          disabled={pending}
          onClick={() => {
            startTransition(async () => {
              const result = await requestEmailVerificationAction();
              if (result.ok) {
                toast({ title: result.message ?? "Verification email sent.", variant: "success" });
              } else {
                toast({ title: result.error, variant: "error" });
              }
            });
          }}
        >
          {pending ? "Sending..." : "Verify now"}
        </Button>
      </AlertDescription>
    </Alert>
  );
}
