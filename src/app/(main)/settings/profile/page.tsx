import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { isGoogleEnabled } from "@/auth.config";
import { DeleteAccountCard } from "@/components/profile/delete-account-card";
import { ExportDataCard } from "@/components/profile/export-data-card";
import { LinkedAccountsCard } from "@/components/profile/linked-accounts-card";
import { ProfileForm } from "@/components/profile/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getOwnProfile, listDepartments } from "@/lib/dal/profiles";
import { requireVerifiedViewer } from "@/lib/dal/session";
import { consumeOAuthLinkError, listLinkedProviders } from "@/lib/oauth-link";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage(props: {
  searchParams: Promise<{ complete?: string; linked?: string }>;
}) {
  const searchParams = await props.searchParams;
  const viewer = await requireVerifiedViewer();
  const [profile, departments, linkedAccounts, linkError] = await Promise.all([
    getOwnProfile(),
    listDepartments(),
    listLinkedProviders(viewer.id),
    consumeOAuthLinkError(),
  ]);

  if (!profile) notFound();

  const needsComplete = searchParams.complete === "1" || !viewer.profileComplete;
  const justLinked = searchParams.linked === "1" && !linkError;

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Edit profile</h1>
          <p className="text-sm text-muted-foreground">
            This is what batchmates see when they find you in the directory.
          </p>
        </div>
        {viewer.profileComplete ? (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/profile/${profile.slug}`}>
              View public profile
              <ExternalLinkIcon />
            </Link>
          </Button>
        ) : null}
      </header>

      {linkError ? (
        <Alert variant="destructive">
          <AlertTitle>Could not link Google</AlertTitle>
          <AlertDescription>{linkError}</AlertDescription>
        </Alert>
      ) : null}

      {justLinked ? (
        <Alert variant="success">
          <AlertTitle>Social login linked</AlertTitle>
          <AlertDescription>
            You can sign in with that provider next time. Your alumni identity is unchanged.
          </AlertDescription>
        </Alert>
      ) : null}

      {needsComplete ? (
        <Alert variant="warning">
          <AlertTitle>Complete your profile to unlock the directory</AlertTitle>
          <AlertDescription>
            After approval you must add your WhatsApp number. College and university details
            help batchmates find you.
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileForm profile={profile} departments={departments} email={viewer.email} />

      <LinkedAccountsCard
        linkedProviders={linkedAccounts.map((account) => account.provider)}
        googleEnabled={isGoogleEnabled}
      />

      <ExportDataCard />
      <DeleteAccountCard />
    </div>
  );
}
