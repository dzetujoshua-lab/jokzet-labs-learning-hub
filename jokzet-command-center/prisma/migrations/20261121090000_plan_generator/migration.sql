-- CreateEnum
CREATE TYPE "PlanPhaseKind" AS ENUM ('FOUNDATION', 'BUILD', 'PROJECT', 'REVIEW');

-- CreateEnum
CREATE TYPE "PlanItemKind" AS ENUM ('TEACHING', 'BASELINE', 'CHECKPOINT', 'PRACTICE', 'REVIEW', 'CATCH_UP');

-- CreateEnum
CREATE TYPE "PlanItemStatus" AS ENUM ('PLANNED', 'MISSED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PlanEventType" AS ENUM ('GENERATED', 'ACTIVATED', 'MISSED', 'CATCH_UP_CREATED', 'EXTENDED', 'PAUSED', 'RESUMED', 'SUBJECTS_CHANGED', 'ITEMS_RELEASED', 'COMPLETED');

-- AlterTable
ALTER TABLE "LearningPlan" ADD COLUMN     "pausedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MissionStep" ADD COLUMN     "minutes" INTEGER;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "planItemId" TEXT;

-- CreateTable
CREATE TABLE "LearningPlanPhase" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "PlanPhaseKind" NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,

    CONSTRAINT "LearningPlanPhase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "phaseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "position" INTEGER NOT NULL,
    "kind" "PlanItemKind" NOT NULL,
    "status" "PlanItemStatus" NOT NULL DEFAULT 'PLANNED',
    "minutes" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "objective" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "departmentId" TEXT,
    "missionId" TEXT,
    "learnerMissionId" TEXT,
    "stepFrom" INTEGER,
    "stepTo" INTEGER,
    "continuesPrev" BOOLEAN NOT NULL DEFAULT false,
    "rescheduledFromId" TEXT,
    "practisedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningPlanEvent" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT,
    "type" "PlanEventType" NOT NULL,
    "fromDate" DATE,
    "toDate" DATE,
    "note" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningPlanEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlanPhase_planId_position_key" ON "LearningPlanPhase"("planId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlanPhase_id_userId_key" ON "LearningPlanPhase"("id", "userId");

-- CreateIndex
CREATE INDEX "LearningPlanItem_userId_date_idx" ON "LearningPlanItem"("userId", "date");

-- CreateIndex
CREATE INDEX "LearningPlanItem_planId_date_idx" ON "LearningPlanItem"("planId", "date");

-- CreateIndex
CREATE INDEX "LearningPlanItem_startAt_idx" ON "LearningPlanItem"("startAt");

-- CreateIndex
CREATE INDEX "LearningPlanItem_learnerMissionId_idx" ON "LearningPlanItem"("learnerMissionId");

-- CreateIndex
CREATE UNIQUE INDEX "LearningPlanItem_id_userId_key" ON "LearningPlanItem"("id", "userId");

-- CreateIndex
CREATE INDEX "LearningPlanEvent_planId_occurredAt_idx" ON "LearningPlanEvent"("planId", "occurredAt");

-- CreateIndex
CREATE INDEX "Notification_planItemId_idx" ON "Notification"("planItemId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_planItemId_fkey" FOREIGN KEY ("planItemId") REFERENCES "LearningPlanItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanPhase" ADD CONSTRAINT "LearningPlanPhase_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "LearningPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "LearningPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_phaseId_userId_fkey" FOREIGN KEY ("phaseId", "userId") REFERENCES "LearningPlanPhase"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "LearningPlanItem_learnerMissionId_fkey" FOREIGN KEY ("learnerMissionId") REFERENCES "LearnerMission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningPlanEvent" ADD CONSTRAINT "LearningPlanEvent_planId_userId_fkey" FOREIGN KEY ("planId", "userId") REFERENCES "LearningPlan"("id", "userId") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Rules Prisma cannot express ───
ALTER TABLE "MissionStep" ADD CONSTRAINT "mission_step_minutes_check" CHECK ("minutes" IS NULL OR "minutes" BETWEEN 1 AND 240);
ALTER TABLE "LearningPlanPhase" ADD CONSTRAINT "plan_phase_dates_check" CHECK ("endDate" >= "startDate");
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_minutes_check" CHECK ("minutes" BETWEEN 1 AND 240);
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_week_check" CHECK ("weekNumber" >= 1);
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_steps_check" CHECK ("stepFrom" IS NULL OR "stepTo" IS NULL OR "stepFrom" <= "stepTo");
-- A catch-up item always points at the missed item it replaces, and nothing else does.
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_catchup_check" CHECK (("kind" = 'CATCH_UP') = ("rescheduledFromId" IS NOT NULL));
-- Only practice is ever "practised".
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_practised_check" CHECK ("practisedAt" IS NULL OR "kind" = 'PRACTICE');
