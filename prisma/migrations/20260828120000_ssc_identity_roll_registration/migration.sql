-- SSC identity is roll + registration. Passing year is metadata, not a second identity.
-- The old indexes allowed the same roll/registration with a different year.

DROP INDEX IF EXISTS "VerificationRequest_ssc_verified_key";
DROP INDEX IF EXISTS "VerificationRequest_ssc_pending_key";

CREATE UNIQUE INDEX "VerificationRequest_ssc_verified_key"
  ON "VerificationRequest" ("sscRoll", "sscRegistration")
  WHERE "status" = 'VERIFIED';

CREATE UNIQUE INDEX "VerificationRequest_ssc_pending_key"
  ON "VerificationRequest" ("sscRoll", "sscRegistration")
  WHERE "status" = 'PENDING';
