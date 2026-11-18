-- Additive only: an AI assessment job per submission, and the AI_ASSESSED assessment status. Nothing existing is changed.

-- CreateEnum
CREATE TYPE "AssessmentJobStatus" AS ENUM ('QUEUED', 'REVIEWING_EVIDENCE', 'AI_IN_PROGRESS', 'AI_COMPLETE', 'NEEDS_HUMAN_REVIEW', 'RETRY_PENDING', 'FAILED');

-- AlterEnum
ALTER TYPE "AssessmentStatus" ADD VALUE 'AI_ASSESSED';

-- CreateTable
CREATE TABLE "AssessmentJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "rubricVersion" INTEGER NOT NULL,
    "rubricSnapshot" JSONB NOT NULL,
    "status" "AssessmentJobStatus" NOT NULL DEFAULT 'QUEUED',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'deepseek',
    "model" TEXT,
    "promptVersion" TEXT,
    "schemaVersion" TEXT,
    "errorCode" TEXT,
    "escalation" TEXT,
    "confidence" DOUBLE PRECISION,
    "result" JSONB,
    "assessmentId" TEXT,
    "tokensIn" INTEGER,
    "tokensOut" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentJob_submissionId_key" ON "AssessmentJob"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentJob_assessmentId_key" ON "AssessmentJob"("assessmentId");

-- CreateIndex
CREATE INDEX "AssessmentJob_status_nextAttemptAt_idx" ON "AssessmentJob"("status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AssessmentJob_userId_createdAt_idx" ON "AssessmentJob"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "AssessmentJob" ADD CONSTRAINT "AssessmentJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentJob" ADD CONSTRAINT "AssessmentJob_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

