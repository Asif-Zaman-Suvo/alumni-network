CREATE TYPE "BloodGroup" AS ENUM (
  'A_POSITIVE',
  'A_NEGATIVE',
  'B_POSITIVE',
  'B_NEGATIVE',
  'O_POSITIVE',
  'O_NEGATIVE',
  'AB_POSITIVE',
  'AB_NEGATIVE'
);

ALTER TABLE "Profile" ADD COLUMN "bloodGroup" "BloodGroup";

CREATE INDEX "Profile_bloodGroup_idx" ON "Profile" ("bloodGroup");
