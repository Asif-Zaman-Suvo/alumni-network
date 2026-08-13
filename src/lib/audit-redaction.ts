import { createHmac } from "node:crypto";

/**
 * Pure redaction helpers for audit rows.
 *
 * Kept free of Prisma and env access so the rules that decide what reaches the database can be
 * unit-tested directly. Everything here operates on attacker-controlled input.
 */

/** Longest stored user agent. Bounds row size against a hostile header. */
export const USER_AGENT_MAX_LENGTH = 400;

/** Longest plausible textual IP, an IPv4-mapped IPv6 address. */
const IP_MAX_LENGTH = 45;

export function sanitiseUserAgent(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  return trimmed.slice(0, USER_AGENT_MAX_LENGTH);
}

/**
 * Extracts the client address from an `x-forwarded-for` chain.
 *
 * The header is a comma-separated client-to-proxy list, so the first entry is the original client.
 * Anything implausibly long is dropped rather than truncated: a truncated address is not merely
 * incomplete, it is wrong, and a wrong address in an audit log is worse than none.
 */
export function sanitiseIpAddress(value: string | null | undefined): string | null {
  if (!value) return null;
  const first = value.split(",")[0]?.trim();
  if (!first || first.length === 0 || first.length > IP_MAX_LENGTH) return null;
  return first;
}

/**
 * Stable pseudonym for an email address that may not belong to any account.
 *
 * Storing the address would turn the audit table into an enumerable list of who has attempted to
 * sign in, including addresses that were only ever typos. A keyed HMAC keeps repeated attempts
 * correlatable without being reversible, and rotating the key retires the correlation.
 */
export function hashAuditSubject(email: string, secret: string): string {
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}
