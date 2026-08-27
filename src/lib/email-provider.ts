import { serverEnv } from "@/env";

/**
 * Brevo Transactional Email API.
 * Source: https://developers.brevo.com/reference/send-transac-email
 *
 * Swap this file to change providers. Callers in `email.ts` stay the same.
 */

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  /** Logged in development when no API key is set, so reset/verify links stay copyable. */
  devLink?: string;
};

type Sender = { name: string; email: string };

function parseSender(from: string): Sender {
  const angled = from.match(/^(.*?)\s*<([^>]+)>\s*$/);
  if (angled?.[1] !== undefined && angled[2] !== undefined) {
    const name = angled[1].trim();
    return { name: name || "Alumni Network", email: angled[2].trim() };
  }
  return { name: "Alumni Network", email: from.trim() };
}

export async function sendOutboundEmail({
  to,
  subject,
  html,
  devLink,
}: OutboundEmail): Promise<void> {
  const apiKey = serverEnv.BREVO_API_KEY;
  if (!apiKey) {
    console.info(
      `[email:dev] to=${to} subject="${subject}"${devLink ? ` link=${devLink}` : ""}`,
    );
    return;
  }

  const sender = parseSender(serverEnv.EMAIL_FROM);

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error(
        `[email] failed to send "${subject}" to ${to}: ${response.status} ${detail}`,
      );
    }
  } catch (error) {
    console.error(`[email] failed to send "${subject}" to ${to}:`, error);
  }
}
