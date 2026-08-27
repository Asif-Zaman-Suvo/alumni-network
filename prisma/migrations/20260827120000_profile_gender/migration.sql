-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN "gender" "Gender";
ALTER TABLE "Profile" ADD COLUMN "showGender" BOOLEAN NOT NULL DEFAULT false;
