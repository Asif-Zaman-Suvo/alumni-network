"use server";

import { signIn } from "@/auth";
import { requireVerifiedViewer } from "@/lib/dal/session";
import { setOAuthLinkIntent } from "@/lib/oauth-link";

/**
 * Shared Google OAuth entry point. Lives in a dedicated server-actions module so Client
 * Components (e.g. register options) can call it — inline "use server" inside a module
 * imported by a Client Component is not allowed.
 */
export async function startGoogleOAuthAction(formData: FormData): Promise<void> {
  const callbackUrl = String(formData.get("callbackUrl") || "/onboarding");
  const linkToCurrentUser = formData.get("linkToCurrentUser") === "1";

  const redirectTo =
    callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")
      ? callbackUrl
      : "/onboarding";

  if (linkToCurrentUser) {
    const viewer = await requireVerifiedViewer();
    await setOAuthLinkIntent(viewer.id);
  }

  await signIn("google", { redirectTo });
}
