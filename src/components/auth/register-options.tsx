"use client";

import * as React from "react";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { RegisterForm } from "@/components/auth/register-form";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

type RegisterOptionsProps = {
  googleEnabled: boolean;
};

/**
 * Google is the primary path. Email+password+SSC stays available for alumni without Google,
 * behind an explicit secondary action so nobody fills the big form by mistake.
 */
export function RegisterOptions({ googleEnabled }: RegisterOptionsProps) {
  const [showEmailForm, setShowEmailForm] = React.useState(!googleEnabled);

  if (!googleEnabled) {
    return <RegisterForm />;
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <OAuthButtons />
        <p className="text-xs text-muted-foreground">
          Fastest path. On the next screen you only enter SSC roll, registration number and
          passing year. Name and photo come from Google. If you already have an approved
          alumni account, those SSC details link this login to it.
        </p>
      </div>

      <div className="relative">
        <Separator />
        <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-2 text-xs uppercase tracking-wide text-muted-foreground">
          or
        </span>
      </div>

      {showEmailForm ? (
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Sign up with email</p>
            <p className="text-xs text-muted-foreground">
              Use this only if you cannot use Google. You will enter name, email, password and
              SSC details here — there is no separate onboarding step.
            </p>
          </div>
          <RegisterForm />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            onClick={() => setShowEmailForm(false)}
          >
            Prefer Google instead
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => setShowEmailForm(true)}
        >
          Sign up with email instead
        </Button>
      )}
    </div>
  );
}
