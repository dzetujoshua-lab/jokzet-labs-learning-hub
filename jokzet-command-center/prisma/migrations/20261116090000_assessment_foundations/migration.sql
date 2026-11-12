-- CreateEnum
CREATE TYPE "AssessorKind" AS ENUM ('SELF', 'AUTOMATED', 'HUMAN');

-- CreateEnum
CREATE TYPE "AssessmentStatus" AS ENUM ('SELF_RECORDED', 'PENDING_REVIEW', 'VERIFIED', 'NEEDS_REVISION', 'REJECTED');

-- CreateEnum
CREATE TYPE "AssuranceTier" AS ENUM ('SELF_ASSESSED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "MissionStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- DropForeignKey
ALTER TABLE "Assessment" DROP CONSTRAINT "Assessment_submissionId_fkey";

-- DropForeignKey
ALTER TABLE "Submission" DROP CONSTRAINT "Submission_learnerMissionId_fkey";

-- AlterTable
ALTER TABLE "Assessment" ADD COLUMN     "assessorKind" "AssessorKind" NOT NULL DEFAULT 'SELF',
ADD COLUMN     "rubricVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "status" "AssessmentStatus" NOT NULL DEFAULT 'SELF_RECORDED';

-- AlterTable
ALTER TABLE "AssessmentRubric" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "AssessmentScore" ADD COLUMN     "criterionName" TEXT,
ADD COLUMN     "maxPoints" INTEGER;

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "status" "MissionStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "UserSkill" ADD COLUMN     "tier" "AssuranceTier" NOT NULL DEFAULT 'SELF_ASSESSED';

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_learnerMissionId_fkey" FOREIGN KEY ("learnerMissionId") REFERENCES "LearnerMission"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE NO ACTION ON UPDATE CASCADE;


-- ─── Hand-written section (reviewed) ───

-- Backfill: freeze what each existing score meant today, so later rubric edits cannot change past results.
UPDATE "AssessmentScore" AS s
SET "criterionName" = c."name", "maxPoints" = c."maxPoints"
FROM "RubricCriterion" AS c
WHERE s."criterionId" = c."id" AND s."criterionName" IS NULL;

-- Backfill: publication status follows the existing isPublished flag.
UPDATE "Mission" SET "status" = CASE WHEN "isPublished" THEN 'PUBLISHED'::"MissionStatus" ELSE 'DRAFT'::"MissionStatus" END;

-- Keep status and the legacy isPublished flag from drifting apart (Prisma cannot express CHECK; it is not reported as drift).
ALTER TABLE "Mission" ADD CONSTRAINT "mission_status_published_check" CHECK (("status" = 'PUBLISHED') = "isPublished");
