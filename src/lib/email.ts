import { Resend } from "resend";
import { clientEnv, serverEnv } from "@/env";

/**
 * Without RESEND_API_KEY (local development), emails are logged instead of sent so the
 * signup and reset flows stay walkable without a live provider.
 */
const resend = serverEnv.RESEND_API_KEY ? new Resend(serverEnv.RESEND_API_KEY) : null;

type SendArgs = {
  to: string;
  subject: string;
  heading: string;
  body: string[];
  action?: { label: string; url: string };
};

function renderHtml({ heading, body, action }: Omit<SendArgs, "to" | "subject">): string {
  const paragraphs = body
    .map(
      (line) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#3f3f46">${line}</p>`,
    )
    .join("");

  const button = action
    ? `<a href="${action.url}" style="display:inline-block;padding:10px 20px;border-radius:8px;background:#1d4ed8;color:#ffffff;font-size:15px;font-weight:600;text-decoration:none">${action.label}</a>
       <p style="margin:20px 0 0;font-size:13px;line-height:1.6;color:#71717a">If the button does not work, paste this link into your browser:<br /><span style="word-break:break-all">${action.url}</span></p>`
    : "";

  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
  <div style="max-width:560px;margin:0 auto;padding:32px;background:#ffffff;border-radius:14px;border:1px solid #e4e4e7">
    <p style="margin:0 0 24px;font-size:13px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#1d4ed8">${clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni Network</p>
    <h1 style="margin:0 0 16px;font-size:21px;line-height:1.3;color:#18181b">${heading}</h1>
    ${paragraphs}
    ${button}
  </div>
</body></html>`;
}

async function send({ to, subject, heading, body, action }: SendArgs): Promise<void> {
  if (!resend) {
    console.info(
      `[email:dev] to=${to} subject="${subject}"${action ? ` link=${action.url}` : ""}`,
    );
    return;
  }

  const result = await resend.emails.send({
    from: serverEnv.EMAIL_FROM,
    to,
    subject,
    html: renderHtml({ heading, body, action }),
  });

  if (result.error) {
    // Never fail the surrounding mutation because of a mail provider hiccup; the user
    // can always trigger a resend, and losing the account write would be worse.
    console.error(`[email] failed to send "${subject}" to ${to}:`, result.error);
  }
}

export function sendEmailVerification(to: string, url: string) {
  return send({
    to,
    subject: "Confirm your email address",
    heading: "Confirm your email address",
    body: [
      "You are one step away from submitting your alumni verification request.",
      "This link expires in 24 hours.",
    ],
    action: { label: "Confirm email", url },
  });
}

export function sendPasswordReset(to: string, url: string) {
  return send({
    to,
    subject: "Reset your password",
    heading: "Reset your password",
    body: [
      "Use the button below to choose a new password. The link expires in one hour and can only be used once.",
      "If you did not request this, you can safely ignore this email.",
    ],
    action: { label: "Choose a new password", url },
  });
}

export function sendVerificationApproved(to: string, name: string) {
  return send({
    to,
    subject: "Your alumni account has been approved",
    heading: `Welcome to the network, ${name}`,
    body: [
      "An administrator has confirmed your SSC details. You now have full access to the alumni directory.",
      "Take a minute to fill in your profile so batchmates can find you.",
    ],
    action: {
      label: "Open the directory",
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/directory`,
    },
  });
}

export function sendVerificationRejected(to: string, reason: string) {
  return send({
    to,
    subject: "We could not verify your alumni details",
    heading: "We could not verify your details",
    body: [
      "An administrator reviewed your submission and could not confirm it.",
      `<strong>Reason given:</strong> ${reason}`,
      "You can correct your details and submit again.",
    ],
    action: {
      label: "Submit again",
      url: `${clientEnv.NEXT_PUBLIC_APP_URL}/verification-status`,
    },
  });
}

export function sendVerificationReceived(to: string) {
  return send({
    to,
    subject: "We received your verification request",
    heading: "Your request is with our team",
    body: [
      "An administrator will check your SSC roll and registration number against school records.",
      "You will get an email as soon as a decision is made. Reviews are usually completed within a few days.",
    ],
  });
}
