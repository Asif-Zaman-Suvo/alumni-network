-- Authentication audit logging, server-side session state, and a private Realtime
-- channel that notifies administrators as events land.
--
-- Ordering matters: the "Role" enum is rebuilt first because "AuditLog"."actorRole"
-- below is declared against it.

-- ---------------------------------------------------------------------------
-- 1. Drop MODERATOR from "Role"
-- ---------------------------------------------------------------------------
-- Postgres cannot remove a value from an enum, so the type is rebuilt. Any remaining
-- moderator is demoted first: the cast in ALTER COLUMN ... TYPE would otherwise abort
-- the migration. Administration is ADMIN-only from here on.
UPDATE "User" SET "role" = 'ALUMNI' WHERE "role" = 'MODERATOR';

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'ALUMNI');

ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'ALUMNI';

ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";

-- ---------------------------------------------------------------------------
-- 2. Session status enum
-- ---------------------------------------------------------------------------
CREATE TYPE "AuthSessionStatus" AS ENUM ('ACTIVE', 'LOGGED_OUT', 'EXPIRED', 'REVOKED');

-- ---------------------------------------------------------------------------
-- 3. Widen "AuditLog" to cover authentication events
-- ---------------------------------------------------------------------------
-- A failed sign-in for an address that was never registered has no actor and no target,
-- so those three columns become nullable. Existing rows already satisfy the new shape.
ALTER TABLE "AuditLog" ALTER COLUMN "actorId" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "targetType" DROP NOT NULL;
ALTER TABLE "AuditLog" ALTER COLUMN "targetId" DROP NOT NULL;

ALTER TABLE "AuditLog"
  ADD COLUMN "actorEmail"  TEXT,
  ADD COLUMN "actorRole"   "Role",
  ADD COLUMN "sessionId"   TEXT,
  ADD COLUMN "provider"    TEXT,
  ADD COLUMN "subjectHash" TEXT,
  ADD COLUMN "reason"      TEXT,
  ADD COLUMN "ipAddress"   TEXT,
  ADD COLUMN "userAgent"   TEXT;

-- Deleting a user must not erase the record of what that user did.
ALTER TABLE "AuditLog" DROP CONSTRAINT "AuditLog_actorId_fkey";
ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill the actor snapshot for rows written before the column existed.
UPDATE "AuditLog" a
SET "actorEmail" = u."email",
    "actorRole"  = u."role"
FROM "User" u
WHERE u."id" = a."actorId"
  AND a."actorEmail" IS NULL;

-- (createdAt, id) descending is the keyset pagination cursor; createdAt alone is not
-- unique enough to page on safely.
CREATE INDEX "AuditLog_createdAt_id_idx" ON "AuditLog" ("createdAt" DESC, "id" DESC);
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog" ("action", "createdAt" DESC);
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog" ("actorId", "createdAt" DESC);
CREATE INDEX "AuditLog_sessionId_idx" ON "AuditLog" ("sessionId");
-- Covers the unindexed-foreign-key advisory on "AuditLog"."actorId".

-- Makes the lifecycle writers idempotent: a retried expiry sweep or a double-fired
-- sign-out cannot produce two terminal events for one session. Scoped to these four
-- actions so repeated staff mutations in one session stay unconstrained.
CREATE UNIQUE INDEX "AuditLog_session_lifecycle_key"
  ON "AuditLog" ("sessionId", "action")
  WHERE "sessionId" IS NOT NULL
    AND "action" IN ('LOGIN_SUCCESS', 'LOGOUT', 'SESSION_EXPIRED', 'SESSION_REVOKED');

-- ---------------------------------------------------------------------------
-- 4. "AuthSession" — the authority for revocation
-- ---------------------------------------------------------------------------
-- Auth.js runs a stateless JWT strategy, so a revoked cookie stays cryptographically
-- valid until it expires. The DAL checks this table on every request instead.
CREATE TABLE "AuthSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AuthSessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "provider" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "endedReason" TEXT,

    CONSTRAINT "AuthSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthSession_userId_issuedAt_idx" ON "AuthSession" ("userId", "issuedAt" DESC);
CREATE INDEX "AuthSession_status_expiresAt_idx" ON "AuthSession" ("status", "expiresAt");

ALTER TABLE "AuthSession"
  ADD CONSTRAINT "AuthSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS on by default. No policy is created, so the Data API cannot reach either table;
-- all access goes through Prisma on the server.
ALTER TABLE "AuthSession" ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 5. Private schema for privileged helpers
-- ---------------------------------------------------------------------------
-- Not added to the Data API's exposed schemas, so nothing in here is reachable over
-- /rest/v1/rpc even though `authenticated` needs USAGE to evaluate the RLS policy below.
CREATE SCHEMA IF NOT EXISTS "app_private";

REVOKE ALL ON SCHEMA "app_private" FROM PUBLIC;
GRANT USAGE ON SCHEMA "app_private" TO "authenticated";

-- ---------------------------------------------------------------------------
-- 6. Broadcast audit events onto a private Realtime channel
-- ---------------------------------------------------------------------------
-- Payload is a deliberately small notification, not the row: ipAddress, userAgent,
-- subjectHash and the unbounded metadata blob stay server-side and are only ever read
-- back through the admin API. Clients treat this as "something arrived, go reconcile".
CREATE OR REPLACE FUNCTION "app_private"."broadcast_audit_log"()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Realtime availability must never decide whether an audit row commits. A failure to
  -- notify degrades the live view, which the client repairs on its next reconcile.
  BEGIN
    PERFORM realtime.send(
      jsonb_build_object(
        'id', NEW."id",
        'action', NEW."action",
        'createdAt', NEW."createdAt",
        'actorEmail', NEW."actorEmail",
        'actorRole', NEW."actorRole",
        'provider', NEW."provider",
        'reason', NEW."reason"
      ),
      'audit_log_created',
      'admin:audit',
      true
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'audit broadcast failed for %: %', NEW."id", SQLERRM;
  END;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION "app_private"."broadcast_audit_log"() FROM PUBLIC;

CREATE TRIGGER "audit_log_broadcast"
AFTER INSERT ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION "app_private"."broadcast_audit_log"();

-- ---------------------------------------------------------------------------
-- 7. Channel authorization
-- ---------------------------------------------------------------------------
-- Re-checks the token's claims against live database state, so a stale token cannot keep
-- a demoted, suspended, or signed-out administrator subscribed. SECURITY DEFINER because
-- `authenticated` has no direct read on "User" or "AuthSession", and it returns only a
-- boolean about the caller's own token.
CREATE OR REPLACE FUNCTION "app_private"."can_read_audit_stream"()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claims jsonb;
  claimed_session text;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL THEN
    RETURN false;
  END IF;

  claimed_session := claims ->> 'app_session_id';
  IF claimed_session IS NULL THEN
    RETURN false;
  END IF;

  -- The token asserting ADMIN is necessary but not sufficient; the row is authoritative.
  IF coalesce(claims ->> 'app_role', '') <> 'ADMIN' THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public."AuthSession" s
    JOIN public."User" u ON u."id" = s."userId"
    WHERE s."id" = claimed_session
      AND s."status" = 'ACTIVE'
      AND s."expiresAt" > now()
      AND u."role" = 'ADMIN'
      AND u."status" = 'VERIFIED'
      AND u."deletedAt" IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION "app_private"."can_read_audit_stream"() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "app_private"."can_read_audit_stream"() TO "authenticated";

-- Read-only subscription to one topic. No INSERT policy exists, so a subscriber cannot
-- broadcast onto the channel — only the trigger above can.
DROP POLICY IF EXISTS "admins_read_audit_stream" ON "realtime"."messages";
CREATE POLICY "admins_read_audit_stream"
ON "realtime"."messages"
FOR SELECT
TO "authenticated"
USING (
  (SELECT realtime.topic()) = 'admin:audit'
  AND "realtime"."messages"."extension" = 'broadcast'
  AND (SELECT "app_private"."can_read_audit_stream"())
);
