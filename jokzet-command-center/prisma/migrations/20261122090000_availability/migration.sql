-- CreateEnum
CREATE TYPE "SchedulingFlexibility" AS ENUM ('STRICT', 'BALANCED', 'FLEXIBLE');

-- AlterTable
ALTER TABLE "LearningPlan" ADD COLUMN     "autoReschedule" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "breakMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "dailyStudyMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "flexibility" "SchedulingFlexibility" NOT NULL DEFAULT 'BALANCED';

-- AlterTable
ALTER TABLE "LearningPlanItem" ADD COLUMN     "slotIndex" INTEGER NOT NULL DEFAULT 0;


-- ─── Rules Prisma cannot express ───
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_daily_minutes_check" CHECK ("dailyStudyMinutes" = 0 OR ("dailyStudyMinutes" >= "sessionMinutes" AND "dailyStudyMinutes" <= 720));
ALTER TABLE "LearningPlan" ADD CONSTRAINT "plan_break_minutes_check" CHECK ("breakMinutes" BETWEEN 0 AND 60);
ALTER TABLE "LearningPlanItem" ADD CONSTRAINT "plan_item_slot_index_check" CHECK ("slotIndex" BETWEEN 0 AND 7);
