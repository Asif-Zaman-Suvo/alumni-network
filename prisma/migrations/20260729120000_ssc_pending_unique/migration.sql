-- At most one active PENDING claim per SSC identity. Paired with the existing
-- VERIFIED partial unique index so concurrent signups cannot double-queue the
-- same roll + registration + year. REJECTED rows stay non-unique so retries work.
CREATE UNIQUE INDEX "VerificationRequest_ssc_pending_key"
  ON "VerificationRequest" ("sscRoll", "sscRegistration", "passingYear")
  WHERE "status" = 'PENDING';
