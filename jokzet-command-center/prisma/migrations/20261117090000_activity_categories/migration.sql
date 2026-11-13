-- CreateEnum
CREATE TYPE "ActivityCategory" AS ENUM ('CURRICULUM_MISSION', 'PERSONAL_ACTIVITY', 'RECOMMENDED_CHALLENGE');

-- CreateEnum
CREATE TYPE "ActivityOrigin" AS ENUM ('LEARNING_PLAN', 'LEARNER_CREATED', 'PLATFORM_RECOMMENDATION', 'ADMIN_ASSIGNED');

-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DISMISSED');

-- AlterTable
ALTER TABLE "Mission" ADD COLUMN     "category" "ActivityCategory" NOT NULL DEFAULT 'CURRICULUM_MISSION',
ADD COLUMN     "origin" "ActivityOrigin" NOT NULL DEFAULT 'LEARNING_PLAN';

-- CreateTable
CREATE TABLE "ActivityRecommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "reasonDetail" TEXT,
    "sourceAssessmentId" TEXT,
    "status" "RecommendationStatus" NOT NULL DEFAULT 'OFFERED',
    "acceptedLearnerMissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ActivityRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ActivityRecommendation_userId_status_idx" ON "ActivityRecommendation"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ActivityRecommendation_userId_missionId_status_key" ON "ActivityRecommendation"("userId", "missionId", "status");

-- AddForeignKey
ALTER TABLE "ActivityRecommendation" ADD CONSTRAINT "ActivityRecommendation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityRecommendation" ADD CONSTRAINT "ActivityRecommendation_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Hand-written section (reviewed) ───

-- Backfill: rows a learner created (the Base44 "New mission" board tasks) are personal activities.
UPDATE "Mission" SET "category" = 'PERSONAL_ACTIVITY', "origin" = 'LEARNER_CREATED' WHERE "createdById" IS NOT NULL;

-- A mission is a curriculum mission exactly when no learner owns it (Prisma cannot express CHECK; not reported as drift).
ALTER TABLE "Mission" ADD CONSTRAINT "mission_category_owner_check" CHECK (("category" = 'CURRICULUM_MISSION') = ("createdById" IS NULL));
