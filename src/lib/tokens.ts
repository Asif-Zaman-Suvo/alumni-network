import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Tokens are stored as SHA-256 digests. A database leak therefore does not hand over
 * working reset links. Plain HMAC-free SHA-256 is sufficient here because the token is
 * 256 bits of CSPRNG output, not a low-entropy secret.
 */

export function createToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function tokensMatch(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000;
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000;
