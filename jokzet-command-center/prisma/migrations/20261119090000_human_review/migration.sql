-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('CONFIRM', 'ADJUST', 'REJECT');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('OPEN', 'CLAIMED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetencyLevel" AS ENUM ('NONE', 'BASIC', 'WORKING', 'STRONG');

-- CreateEnum
CREATE TYPE "CompetencySource" AS ENUM ('BASELINE', 'ASSESSED');

-- CreateEnum
CREATE TYPE "RoleAuditAction" AS ENUM ('GRANTED', 'REVOKED', 'SCOPE_ADDED', 'SCOPE_REMOVED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "UserRole" ADD VALUE 'AUTHOR';
ALTER TYPE "UserRole" ADD VALUE 'REVIEWER';

-- CreateTable
CREATE TABLE "ReviewerScope" (
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewerScope_pkey" PRIMARY KEY ("userId","departmentId")
);

-- CreateTable
CREATE TABLE "ReviewRequest" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'OPEN',
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "ReviewRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReview" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewerLabel" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "reason" TEXT,
    "rubricVersion" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "maxPoints" INTEGER NOT NULL,
    "percentage" INTEGER NOT NULL,
    "outcome" "AssessmentOutcome" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentReviewScore" (
    "reviewId" TEXT NOT NULL,
    "criterionId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "comment" TEXT,
    "criterionName" TEXT NOT NULL,
    "maxPoints" INTEGER NOT NULL,

    CONSTRAINT "AssessmentReviewScore_pkey" PRIMARY KEY ("reviewId","criterionId")
);

-- CreateTable
CREATE TABLE "EvidenceAccessLog" (
    "id" TEXT NOT NULL,
    "evidenceId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "reviewRequestId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillCompetency" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "skillId" TEXT NOT NULL,
    "level" "CompetencyLevel" NOT NULL,
    "source" "CompetencySource" NOT NULL,
    "assessmentId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SkillCompetency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoleAudit" (
    "id" TEXT NOT NULL,
    "targetUserId" TEXT NOT NULL,
    "targetEmail" TEXT NOT NULL,
    "action" "RoleAuditAction" NOT NULL,
    "role" TEXT,
    "departmentCode" TEXT,
    "actor" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoleAudit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReviewRequest_assessmentId_key" ON "ReviewRequest"("assessmentId");

-- CreateIndex
CREATE INDEX "ReviewRequest_status_createdAt_idx" ON "ReviewRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ReviewRequest_userId_idx" ON "ReviewRequest"("userId");

-- CreateIndex
CREATE INDEX "AssessmentReview_assessmentId_createdAt_idx" ON "AssessmentReview"("assessmentId", "createdAt");

-- CreateIndex
CREATE INDEX "AssessmentReview_userId_idx" ON "AssessmentReview"("userId");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_evidenceId_idx" ON "EvidenceAccessLog"("evidenceId");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_reviewerId_at_idx" ON "EvidenceAccessLog"("reviewerId", "at");

-- CreateIndex
CREATE INDEX "EvidenceAccessLog_learnerId_at_idx" ON "EvidenceAccessLog"("learnerId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "SkillCompetency_userId_skillId_key" ON "SkillCompetency"("userId", "skillId");

-- CreateIndex
CREATE INDEX "RoleAudit_targetUserId_at_idx" ON "RoleAudit"("targetUserId", "at");

-- AddForeignKey
ALTER TABLE "ReviewerScope" ADD CONSTRAINT "ReviewerScope_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewerScope" ADD CONSTRAINT "ReviewerScope_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "ReviewRequest_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "AssessmentReview_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "AssessmentReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentReviewScore" ADD CONSTRAINT "AssessmentReviewScore_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "AssessmentReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "Skill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillCompetency" ADD CONSTRAINT "SkillCompetency_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- ─── Hand-written section (reviewed) ───
-- Nothing to backfill: every existing user keeps their role, and no review exists yet.

-- A reviewer can never claim or review their own work (enforced by the database, not only by the application).
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "review_request_not_own_work_check" CHECK ("claimedById" IS NULL OR "claimedById" <> "userId");
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "assessment_review_not_own_work_check" CHECK ("reviewerId" IS NULL OR "reviewerId" <> "userId");
-- A claimed request says who claimed it.
ALTER TABLE "ReviewRequest" ADD CONSTRAINT "review_request_claimed_has_owner_check" CHECK ("status" <> 'CLAIMED' OR "claimedById" IS NOT NULL);
-- Adjusting or rejecting needs a written reason the learner can read.
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "assessment_review_reason_check" CHECK ("decision" = 'CONFIRM' OR ("reason" IS NOT NULL AND length(btrim("reason")) >= 10));
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "assessment_review_percentage_check" CHECK ("percentage" BETWEEN 0 AND 100 AND "totalPoints" >= 0 AND "totalPoints" <= "maxPoints");
