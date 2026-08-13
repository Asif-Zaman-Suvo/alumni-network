import { z } from "zod";

/**
 * Fail fast on misconfiguration. Server variables are only validated on the server so
 * client bundles never reference them.
 */

/**
 * Treats an empty string as "not set". Deployment platforms and .env files routinely define
 * optional keys as empty rather than omitting them, and `z.string().min(1).optional()` would
 * reject that.
 */
const optionalSecret = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().min(1).optional(),
);

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Pooled connection (Supabase pgbouncer, port 6543) for the app runtime.
  DATABASE_URL: z.string().url(),
  // Direct connection (port 5432) — required by Prisma Migrate, which cannot run through pgbouncer.
  DIRECT_URL: z.string().url(),

  AUTH_SECRET: z.string().min(32, "Generate one with `openssl rand -base64 32`"),
  AUTH_URL: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().url().optional(),
  ),
  AUTH_GOOGLE_ID: optionalSecret,
  AUTH_GOOGLE_SECRET: optionalSecret,
  AUTH_FACEBOOK_ID: optionalSecret,
  AUTH_FACEBOOK_SECRET: optionalSecret,

  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_CERTIFICATE_BUCKET: z.string().min(1).default("verification-documents"),
  SUPABASE_AVATAR_BUCKET: z.string().min(1).default("avatars"),

  /**
   * Keys the HMAC that turns a submitted email into `AuditLog.subjectHash`. Rotating this
   * makes older failed-login hashes uncorrelatable with newer ones, which is an acceptable
   * trade for being able to retire the key.
   */
  AUDIT_HASH_SECRET: z.string().min(32, "Generate one with `openssl rand -base64 32`"),

  /**
   * ES256 private key (JWK, JSON) that is also imported into Supabase as the CURRENT JWT
   * signing key — Supabase holds the pair and publishes the public half, so the same private
   * key that signs here is what verification resolves to. Used only to mint the short-lived
   * tokens that authorize the admin Realtime channel. See .env.example for the full procedure.
   * Optional: without it the live stream degrades to manual refresh rather than failing boot.
   */
  SUPABASE_REALTIME_JWK: optionalSecret,
  SUPABASE_REALTIME_JWT_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(600),

  /** Shared secret for the Vercel cron that reaps expired sessions. */
  CRON_SECRET: optionalSecret,

  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: z.string().min(1).default("Alumni Network <onboarding@resend.dev>"),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SCHOOL_NAME: z.string().min(1).default("Our School"),
});

function formatIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function parseClientEnv() {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SCHOOL_NAME: process.env.NEXT_PUBLIC_SCHOOL_NAME,
  });

  if (!parsed.success) {
    throw new Error(`Invalid public environment variables:\n${formatIssues(parsed.error)}`);
  }

  return parsed.data;
}

function parseServerEnv() {
  const parsed = serverSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid server environment variables:\n${formatIssues(parsed.error)}`);
  }

  return parsed.data;
}

export const clientEnv = parseClientEnv();

/**
 * Access server-only configuration. Throws if reached from a client bundle so a bad import
 * surfaces at build time instead of leaking secrets.
 */
export const serverEnv: z.infer<typeof serverSchema> = (() => {
  if (typeof window !== "undefined") {
    return new Proxy({} as z.infer<typeof serverSchema>, {
      get(_target, prop) {
        throw new Error(`Attempted to read server env "${String(prop)}" on the client.`);
      },
    });
  }

  return parseServerEnv();
})();

export const isProduction = process.env.NODE_ENV === "production";
