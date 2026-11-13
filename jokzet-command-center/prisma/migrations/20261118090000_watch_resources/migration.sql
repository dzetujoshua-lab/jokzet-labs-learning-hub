-- CreateEnum
CREATE TYPE "ResourceKind" AS ENUM ('VIDEO', 'PLAYLIST', 'DOCUMENTATION', 'INTERACTIVE', 'ORIGINAL', 'DEMONSTRATION');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "LearningResource" (
    "id" TEXT NOT NULL,
    "canonicalUrl" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "kind" "ResourceKind" NOT NULL,
    "title" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "language" TEXT NOT NULL DEFAULT 'en',
    "level" TEXT,
    "embeddable" BOOLEAN NOT NULL DEFAULT false,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'DRAFT',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "lastVerifiedAt" TIMESTAMP(3),
    "licenceNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningResource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissionResource" (
    "missionId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MissionResource_pkey" PRIMARY KEY ("missionId","resourceId")
);

-- CreateTable
CREATE TABLE "ResourceReview" (
    "id" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "reviewerName" TEXT NOT NULL,
    "decision" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResourceEngagement" (
    "userId" TEXT NOT NULL,
    "resourceId" TEXT NOT NULL,
    "lastEvent" TEXT NOT NULL,
    "progressPct" INTEGER,
    "bookmarked" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "externalOpenedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResourceEngagement_pkey" PRIMARY KEY ("userId","resourceId")
);

-- CreateIndex
CREATE UNIQUE INDEX "LearningResource_canonicalUrl_key" ON "LearningResource"("canonicalUrl");

-- CreateIndex
CREATE INDEX "LearningResource_status_idx" ON "LearningResource"("status");

-- CreateIndex
CREATE INDEX "MissionResource_resourceId_idx" ON "MissionResource"("resourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ResourceReview_resourceId_reviewerName_at_key" ON "ResourceReview"("resourceId", "reviewerName", "at");

-- CreateIndex
CREATE INDEX "ResourceEngagement_resourceId_idx" ON "ResourceEngagement"("resourceId");

-- AddForeignKey
ALTER TABLE "MissionResource" ADD CONSTRAINT "MissionResource_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissionResource" ADD CONSTRAINT "MissionResource_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceReview" ADD CONSTRAINT "ResourceReview_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceEngagement" ADD CONSTRAINT "ResourceEngagement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResourceEngagement" ADD CONSTRAINT "ResourceEngagement_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "LearningResource"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- ─── Hand-written section (reviewed) ───
-- No backfill: the 18 legacy "Resource" placeholders have no URL, so there is nothing real to migrate. They stay as they are.

-- A mission has at most one PRIMARY resource.
CREATE UNIQUE INDEX "MissionResource_one_primary_per_mission" ON "MissionResource"("missionId") WHERE "role" = 'PRIMARY';

ALTER TABLE "MissionResource" ADD CONSTRAINT "mission_resource_role_check" CHECK ("role" IN ('PRIMARY', 'SUPPLEMENTARY'));
-- Learners are only ever sent to https links.
ALTER TABLE "LearningResource" ADD CONSTRAINT "learning_resource_https_check" CHECK ("canonicalUrl" ~ '^https://');
-- An approved resource must say who approved it and when.
ALTER TABLE "LearningResource" ADD CONSTRAINT "learning_resource_approval_check" CHECK ("status" <> 'APPROVED' OR ("approvedBy" IS NOT NULL AND "approvedAt" IS NOT NULL));
ALTER TABLE "ResourceReview" ADD CONSTRAINT "resource_review_decision_check" CHECK ("decision" IN ('APPROVED', 'CHANGES_REQUESTED', 'REJECTED'));
ALTER TABLE "ResourceEngagement" ADD CONSTRAINT "resource_engagement_progress_check" CHECK ("progressPct" IS NULL OR ("progressPct" BETWEEN 0 AND 100));
