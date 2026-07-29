import { OAuthButtons } from "@/components/auth/oauth-buttons";

/** @deprecated Prefer OAuthButtons — kept so existing imports keep compiling during the rename. */
export function GoogleButton({ callbackUrl = "/onboarding" }: { callbackUrl?: string }) {
  return <OAuthButtons callbackUrl={callbackUrl} />;
}
