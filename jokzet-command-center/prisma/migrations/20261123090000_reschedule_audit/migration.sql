-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "PlanEventType" ADD VALUE 'RESCHEDULED';
ALTER TYPE "PlanEventType" ADD VALUE 'AVAILABILITY_CHANGED';
ALTER TYPE "PlanEventType" ADD VALUE 'PREFERENCES_CHANGED';

-- AlterTable
ALTER TABLE "LearningPlanEvent" ADD COLUMN     "actor" TEXT NOT NULL DEFAULT 'SYSTEM',
ADD COLUMN     "fromSlotIndex" INTEGER,
ADD COLUMN     "fromStartAt" TIMESTAMP(3),
ADD COLUMN     "reason" TEXT,
ADD COLUMN     "toSlotIndex" INTEGER,
ADD COLUMN     "toStartAt" TIMESTAMP(3);


-- ─── Rules Prisma cannot express ───
ALTER TABLE "LearningPlanEvent" ADD CONSTRAINT "plan_event_actor_check" CHECK ("actor" IN ('LEARNER', 'SYSTEM'));
ALTER TABLE "LearningPlanEvent" ADD CONSTRAINT "plan_event_slots_check" CHECK (("fromSlotIndex" IS NULL OR "fromSlotIndex" BETWEEN 0 AND 7) AND ("toSlotIndex" IS NULL OR "toSlotIndex" BETWEEN 0 AND 7));
ALTER TABLE "LearningPlanEvent" ADD CONSTRAINT "plan_event_reason_check" CHECK ("reason" IS NULL OR char_length("reason") <= 500);
