import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type LinkedAccountsCardProps = {
  linkedProviders: string[];
  googleEnabled: boolean;
};

export function LinkedAccountsCard({
  linkedProviders,
  googleEnabled,
}: LinkedAccountsCardProps) {
  const hasGoogle = linkedProviders.includes("google");
  const canLinkGoogle = googleEnabled && !hasGoogle;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Sign-in methods</CardTitle>
        <CardDescription>
          Link Google to this alumni account. Linking uses your verified session — you will
          not be asked for SSC again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-1 text-sm text-muted-foreground">
          <li>Email &amp; password: available if you set a password at registration.</li>
          <li>Google: {hasGoogle ? "linked" : "not linked"}</li>
        </ul>

        {canLinkGoogle ? (
          <OAuthButtons callbackUrl="/settings/profile?linked=1" linkToCurrentUser />
        ) : hasGoogle ? (
          <p className="text-sm text-muted-foreground">Google is already linked.</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Google sign-in is not configured on this deployment.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
