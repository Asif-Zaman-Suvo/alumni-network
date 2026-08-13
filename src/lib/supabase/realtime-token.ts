import { importJWK, SignJWT, type JWTPayload } from "jose";
import { serverEnv } from "@/env";
import type { Viewer } from "@/lib/dal/session";

/**
 * Mints the short-lived tokens that authorize a private Supabase Realtime channel.
 *
 * Supabase Realtime authorizes a subscription by running the RLS policy on `realtime.messages`
 * with the claims of whatever JWT the socket presents. This application does not use Supabase
 * Auth, so there is no Supabase-issued token to present — we sign our own with a key registered
 * as a Supabase JWT signing key, and the policy reads our claims.
 *
 * Two things follow from that, and both are deliberate:
 *
 *   1. `sub` is a CUID from `public.User`, not a UUID in `auth.users`, so the policy must not use
 *      `auth.uid()`. It reads `app_user_id` / `app_role` / `app_session_id` instead.
 *   2. Claims are a snapshot. The TTL is minutes, not the 30 days of the session cookie, because
 *      the token is the window during which a just-revoked administrator can still be subscribed.
 */

/** The topic this token grants. Kept in one place so the policy and the client cannot drift. */
export const AUDIT_CHANNEL_TOPIC = "admin:audit";

export class RealtimeTokenUnavailableError extends Error {
  constructor() {
    super("Realtime signing key is not configured.");
    this.name = "RealtimeTokenUnavailableError";
  }
}

export function isRealtimeConfigured(): boolean {
  return Boolean(serverEnv.SUPABASE_REALTIME_JWK);
}

/** jose stopped exporting a key union type in v6; derive it from the import function instead. */
type SigningKey = Awaited<ReturnType<typeof importJWK>>;

let cachedKey: Promise<SigningKey> | null = null;
let cachedKeyId: string | undefined;

/**
 * Imports the signing key once per process. Key import is pure CPU work but not free, and this
 * runs on every dashboard mount and refresh.
 */
async function getSigningKey(): Promise<{
  key: SigningKey;
  keyId: string | undefined;
}> {
  if (!serverEnv.SUPABASE_REALTIME_JWK) throw new RealtimeTokenUnavailableError();

  if (!cachedKey) {
    const jwk = JSON.parse(serverEnv.SUPABASE_REALTIME_JWK) as {
      kid?: string;
      alg?: string;
    };
    cachedKeyId = jwk.kid;
    cachedKey = importJWK(jwk, jwk.alg ?? "ES256");
  }

  return { key: await cachedKey, keyId: cachedKeyId };
}

export type RealtimeToken = {
  token: string;
  /** Epoch ms. The client refreshes before this, rather than waiting for the socket to drop. */
  expiresAt: number;
  topic: string;
};

/**
 * Issues a token for the audit channel. Callers must have already established that the viewer is
 * an administrator; this function does not re-check, and the RLS policy verifies the claims
 * against live database state regardless.
 */
export async function mintAuditChannelToken(viewer: Viewer): Promise<RealtimeToken> {
  const { key, keyId } = await getSigningKey();
  const ttlSeconds = serverEnv.SUPABASE_REALTIME_JWT_TTL_SECONDS;
  const issuedAt = Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + ttlSeconds;

  const claims: JWTPayload = {
    sub: viewer.id,
    // Supabase requires this to be a recognised Postgres role; it selects which role the policy
    // runs as. Authorization comes from the app_* claims below, never from this value.
    role: "authenticated",
    app_user_id: viewer.id,
    app_role: viewer.role,
    app_session_id: viewer.sessionId,
  };

  const token = await new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256", typ: "JWT", ...(keyId ? { kid: keyId } : {}) })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(key);

  return { token, expiresAt: expiresAt * 1000, topic: AUDIT_CHANNEL_TOPIC };
}
