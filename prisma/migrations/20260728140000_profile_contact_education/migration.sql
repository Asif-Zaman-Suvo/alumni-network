-- AlterTable
ALTER TABLE "User" ADD COLUMN "profileComplete" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "Profile" ADD COLUMN "facebookUrl" TEXT;
ALTER TABLE "Profile" ADD COLUMN "collegeName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "collegeDepartment" TEXT;
ALTER TABLE "Profile" ADD COLUMN "collegeSession" TEXT;
ALTER TABLE "Profile" ADD COLUMN "universityName" TEXT;
ALTER TABLE "Profile" ADD COLUMN "universityDepartment" TEXT;
ALTER TABLE "Profile" ADD COLUMN "universitySession" TEXT;

-- Seeded / already-active alumni: mark complete so they keep directory access.
UPDATE "User" SET "profileComplete" = true WHERE "status" = 'VERIFIED';
