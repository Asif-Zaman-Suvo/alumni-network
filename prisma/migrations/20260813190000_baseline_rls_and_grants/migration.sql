-- Codifies the two protections that currently exist only as manual database state.
--
-- Production already looks exactly like this: every public table has RLS enabled with no
-- policy, and anon/authenticated/service_role hold no DML on any of them. None of that was
-- ever written down, so a database built from these migrations alone — a preview branch, a
-- second environment, a restore into a fresh project — would come up with Supabase's stock
-- defaults instead: RLS off, and `GRANT ALL ON TABLES TO anon` from the default privileges.
-- That combination exposes every row, including "User" and "PasswordResetToken", through the
-- Data API to anyone holding the publishable key.
--
-- Every statement below is idempotent and is a verified no-op against current production.
--
-- Two independent layers, deliberately:
--   1. RLS with no policy      — denies everything even if a grant is later added by mistake.
--   2. No DML grant at all     — denies everything even if a policy is later added by mistake.
-- The application does not use the Data API; all access is Prisma over a direct connection as
-- the table owner, which is subject to neither.

-- ---------------------------------------------------------------------------
-- 1. Row level security on every application table
-- ---------------------------------------------------------------------------
-- No FORCE: the owner (postgres) must keep bypassing RLS, because that is the role Prisma
-- connects as and the role that runs these migrations.
ALTER TABLE "public"."Account"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuditLog"            ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."AuthSession"         ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Department"          ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PasswordResetToken"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Profile"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."RateLimitHit"        ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Session"             ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."User"                ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."VerificationToken"   ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Remove the Data API roles' table privileges
-- ---------------------------------------------------------------------------
-- Guarded because these roles exist only on Supabase. A plain Postgres — a local development
-- database, or CI — has no anon/authenticated/service_role, and REVOKE against a missing role
-- is an error that would abort the migration.
DO $$
DECLARE
  target_role text;
BEGIN
  FOREACH target_role IN ARRAY ARRAY['anon', 'authenticated', 'service_role'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
      EXECUTE format(
        'REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM %I',
        target_role
      );

      -- Tables created after this migration inherit the same restriction, so a future
      -- Prisma migration cannot silently reintroduce a publicly writable table. Scoped to
      -- the role running the migration, which is the role that owns the tables it creates.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM %I',
        target_role
      );
    END IF;
  END LOOP;
END
$$;
