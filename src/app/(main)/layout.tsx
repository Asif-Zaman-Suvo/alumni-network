import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { EmailVerificationBanner } from "@/components/auth/email-verification-banner";
import { getViewer } from "@/lib/dal/session";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();

  return (
    <div className="flex min-h-dvh flex-col">
      <SiteHeader />
      {viewer && !viewer.emailVerified ? (
        <div className="border-b border-border bg-background px-4 py-3 sm:px-6">
          <div className="mx-auto max-w-6xl">
            <EmailVerificationBanner email={viewer.email} />
          </div>
        </div>
      ) : null}
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
