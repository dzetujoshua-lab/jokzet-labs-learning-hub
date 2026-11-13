-- CreateEnum
CREATE TYPE "MissionRole" AS ENUM ('LESSON', 'BASELINE', 'CHECKPOINT');

-- CreateEnum
CREATE TYPE "LearnerMode" AS ENUM ('LEGACY', 'PERSONALISED');

-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETE');

-- CreateEnum
CREATE TYPE "ExperienceLevel" AS ENUM ('BEGINNER', 'IMPROVER', 'INTERMEDIATE', 'ADVANCED');

-- CreateEnum
CREATE TYPE "DurationKind" AS ENUM ('TWO_WEEKS', 'ONE_MONTH', 'THREE_MONTHS', 'SIX_MONTHS', 'ONE_YEAR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "BaselineStatus" AS ENUM ('PENDING', 'SUBMITTED', 'ASSESSED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "role" "MissionRole" NOT NULL DEFAULT 'LESSON';

-- AlterTable
-- Existing accounts keep the original programme: they are backfilled to LEGACY / COMPLETE by adding the columns with those
-- defaults, then the column defaults for NEW rows are switched to PERSONALISED / NOT_STARTED.
ALTER TABLE "Profile" ADD COLUMN     "learnerMode" "LearnerMode" NOT NULL DEFAULT 'LEGACY',
ADD COLUMN     "onboardingStatus" "OnboardingStatus" NOT NULL DEFAULT 'COMPLETE';
ALTER TABLE "Profile" ALTER COLUMN "learnerMode" SET DEFAULT 'PERSONALISED',
ALTER COLUMN "onboardingStatus" SET DEFAULT 'NOT_STARTED';

-- CreateTable
CREATE TABLE "LearningPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "draftKey" TEXT,
    "activeKey" TEXT,
    "parentPlanId" TEXT,
    "durationKind" "DurationKind" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "experience" "ExperienceLevel" NOT NULL,
    "sessionMinutes" INTEGER NOT NULL,
    "weekdays" INTEGER[],
    "startTime" TEXT NOT NULL,
    "generatorVersion" INTEGER NOT NULL DEFAULT 0,
    "catalogVersion" TEXT NOT NULL DEFAULT '',
    "inputHash" TEXT NOT NULL DEFAULT '',
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "activatedAt" TIMESTAMP(3),
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "LearningPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningGoal" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "targetLevel" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BaselineAssessment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "learnerMissionId" TEXT,
    "status" "BaselineStatus" NOT NULL DEFAULT 'PENDING',
    "percentage" INTEGER,
    "placementLevel" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BaselineAssessment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_draftKey_key" ON "LearningPlan"("draftKey");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_activeKey_key" ON "LearningPlan"("activeKey");

-- CreateIndex
CREATE INDEX "LearningPlan_userId_status_idx" ON "LearningPlan"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlan_id_userId_key" ON "LearningPlan"("id", "userId");

-- CreateIndex
CREATE INDEX "LearningGoal_userId_idx" ON "LearningGoal"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningGoal_planId_departmentId_key" ON "LearningGoal"("planId", "departmentId");

-- CreateIndex
CREATE INDEX "BaselineAssessment_userId_idx" ON "BaselineAssessment"("userId");

-- CreateIndex
CREATE INDEX "BaselineAssessment_learnerMissionId_idx" ON "BaselineAssessment"("learnerMissionId");

-- CreateIndex
CREATE UNIQUE INDEX "BaselineAssessment_planId_departmentId_key" ON "BaselineAssessment"("planId", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "LearnerMission_id_userId_key" ON "LearnerMission"("id", "userId");

-- AddForeignKey
ALTER TABLE "LearningPlan" ADD CONSTRAINT "LearningPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "LearningPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningGoal" ADD CONSTRAINT "LearningGoal_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "BaselineAssessment_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "LearningPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "BaselineAssessment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "BaselineAssessment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "BaselineAssessment_learnerMissionId_fkey" FOREIGN KEY ("learnerMissionId") REFERENCES "LearnerMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Accounts without a profile row (the database does not require one) get a LEGACY / COMPLETE profile, so nobody is ever
-- sent into onboarding by this release.
INSERT INTO "Profile" ("id", "userId", "displayName", "learnerMode", "onboardingStatus", "updatedAt")
SELECT gen_random_uuid()::text, u."id", split_part(u."email", '@', 1), 'LEGACY', 'COMPLETE', CURRENT_TIMESTAMP
FROM "User" u WHERE NOT EXISTS (SELECT 1 FROM "Profile" p WHERE p."userId" = u."id");

-- ─── Rules Prisma cannot express ───
-- One DRAFT and one ACTIVE plan per learner: the key column equals the user id exactly while the plan is in that state.
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_draft_key_check" CHECK (("status" = 'DRAFT') = ("draftKey" IS NOT NULL AND "draftKey" = "userId"));
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_active_key_check" CHECK (("status" = 'ACTIVE') = ("activeKey" IS NOT NULL AND "activeKey" = "userId"));
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_session_minutes_check" CHECK ("sessionMinutes" BETWEEN 15 AND 240);
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_duration_days_check" CHECK ("durationDays" BETWEEN 7 AND 365);
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_weekdays_check" CHECK (cardinality("weekdays") BETWEEN 1 AND 7 AND "weekdays" <@ ARRAY[0,1,2,3,4,5,6]);
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_dates_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "LearningGoal" ADD CONSTRAINT "goal_weight_check" CHECK ("weight" BETWEEN 1 AND 5);
ALTER TABLE "LearningGoal" ADD CONSTRAINT "goal_target_level_check" CHECK ("targetLevel" BETWEEN 0 AND 5);
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "baseline_percentage_check" CHECK ("percentage" IS NULL OR "percentage" BETWEEN 0 AND 100);
ALTER TABLE "BaselineAssessment" ADD CONSTRAINT "baseline_placement_check" CHECK ("placementLevel" IS NULL OR "placementLevel" >= 0);
