-- CreateEnum
CREATE TYPE "MissionKind" AS ENUM ('BUILD', 'DESIGN', 'DRILL', 'STUDY', 'SHOOT', 'EDIT', 'WRITE', 'SHIP');

-- CreateEnum
CREATE TYPE "EvidenceType" AS ENUM ('SCREENSHOT', 'PHOTO', 'VIDEO', 'CODE', 'DOCUMENT', 'LINK');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "LearnerMissionStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "LearnerMissionStatus" ADD VALUE 'SKIPPED';

-- DropForeignKey
ALTER TABLE "Mission" DROP CONSTRAINT "Mission_levelId_fkey";

-- AlterTable
ALTER TABLE "LearnerDepartment" ADD COLUMN     "nextMilestone" TEXT;

-- AlterTable
ALTER TABLE "LearnerMission" ADD COLUMN     "xpAwarded" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "evidenceType" "EvidenceType" NOT NULL DEFAULT 'SCREENSHOT',
ADD COLUMN     "kind" "MissionKind" NOT NULL DEFAULT 'BUILD',
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "xpReward" INTEGER NOT NULL DEFAULT 25,
ALTER COLUMN "code" DROP NOT NULL,
ALTER COLUMN "levelId" DROP NOT NULL,
ALTER COLUMN "objective" DROP NOT NULL,
ALTER COLUMN "durationMinutes" SET DEFAULT 45,
ALTER COLUMN "experimentChallenge" DROP NOT NULL,
ALTER COLUMN "submissionRequirements" DROP NOT NULL,
ALTER COLUMN "remediation" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Mission_createdById_idx" ON "Mission"("createdById");

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_levelId_fkey" FOREIGN KEY ("levelId") REFERENCES "Level"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mission" ADD CONSTRAINT "Mission_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
