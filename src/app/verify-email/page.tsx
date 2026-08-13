import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CheckCircle2Icon, TriangleAlertIcon } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { unstable_update } from "@/auth";
import { homeForStatus } from "@/lib/auth-routes";
import { getViewer } from "@/lib/dal/session";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/tokens";

export const metadata: Metadata = {
  title: "Verify email",
  robots: { index: false, follow: false },
};

type SearchParams = { token?: string; email?: string };

export default async function VerifyEmailPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const searchParams = await props.searchParams;
  const token = searchParams.token?.trim();
  const email = searchParams.email?.trim().toLowerCase();

  if (!token || !email) {
    return (
      <VerifyResult
        ok={false}
        title="Invalid verification link"
        body="This link is missing required details. Request a new one from your profile or home page."
      />
    );
  }

  const record = await prisma.verificationToken.findUnique({
    where: {
      identifier_token: {
        identifier: email,
        token: hashToken(token),
      },
    },
  });

  if (!record || record.expires < new Date()) {
    return (
      <VerifyResult
        ok={false}
        title="Link expired"
        body="This confirmation link is no longer valid. Sign in and tap Verify now to get a fresh email."
      />
    );
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!user) {
    return (
      <VerifyResult
        ok={false}
        title="Account not found"
        body="No account matches this email. Register again or contact the alumni office."
      />
    );
  }

  if (!user.emailVerified) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      }),
      prisma.verificationToken.deleteMany({ where: { identifier: email } }),
    ]);
  } else {
    await prisma.verificationToken.deleteMany({ where: { identifier: email } });
  }

  const viewer = await getViewer();
  if (viewer) {
    await unstable_update({});
    redirect(
      homeForStatus(viewer.status, {
        profileComplete: viewer.profileComplete,
        isAdmin: viewer.isAdmin,
      }),
    );
  }

  return (
    <VerifyResult
      ok
      title="Email verified"
      body="Your email address is confirmed. Sign in to continue."
      href="/login"
      hrefLabel="Sign in"
    />
  );
}

function VerifyResult({
  ok,
  title,
  body,
  href = "/",
  hrefLabel = "Back home",
}: {
  ok: boolean;
  title: string;
  body: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-12">
      <Alert variant={ok ? "success" : "destructive"}>
        {ok ? <CheckCircle2Icon /> : <TriangleAlertIcon />}
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{body}</AlertDescription>
      </Alert>
      <Button asChild>
        <Link href={href}>{hrefLabel}</Link>
      </Button>
    </div>
  );
}
