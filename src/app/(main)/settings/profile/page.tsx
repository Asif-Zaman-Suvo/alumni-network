import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { DeleteAccountCard } from "@/components/profile/delete-account-card";
import { ExportDataCard } from "@/components/profile/export-data-card";
import { ProfileForm } from "@/components/profile/profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getOwnProfile, listDepartments } from "@/lib/dal/profiles";
import { requireVerifiedViewer } from "@/lib/dal/session";

export const metadata: Metadata = {
  title: "Edit profile",
  robots: { index: false, follow: false },
};

export default async function ProfileSettingsPage(props: {
  searchParams: Promise<{ complete?: string }>;
}) {
  const searchParams = await props.searchParams;
  const viewer = await requireVerifiedViewer();
  const [profile, departments] = await Promise.all([getOwnProfile(), listDepartments()]);

  if (!profile) notFound();

  const needsComplete = searchParams.complete === "1" || !viewer.profileComplete;

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

      {needsComplete ? (
        <Alert variant="warning">
          <AlertTitle>Complete your profile to unlock the directory</AlertTitle>
          <AlertDescription>
            After approval you must add your WhatsApp number and Facebook profile link. College
            and university details help batchmates find you.
          </AlertDescription>
        </Alert>
      ) : null}

      <ProfileForm profile={profile} departments={departments} email={viewer.email} />

      <ExportDataCard />
      <DeleteAccountCard />
    </div>
  );
}
