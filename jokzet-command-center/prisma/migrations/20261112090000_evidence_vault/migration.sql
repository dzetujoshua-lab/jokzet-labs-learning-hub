-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('LOGGED', 'VERIFIED');

-- DropForeignKey
ALTER TABLE "SubmissionFile" DROP CONSTRAINT "SubmissionFile_submissionId_fkey";

-- DropIndex
DROP INDEX "SubmissionFile_submissionId_idx";

-- AlterTable
ALTER TABLE "SubmissionFile" DROP COLUMN "submissionId";

-- CreateTable
CREATE TABLE "EvidenceItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "missionId" TEXT,
    "submissionId" TEXT,
    "title" TEXT NOT NULL,
    "kind" "EvidenceType" NOT NULL,
    "description" TEXT,
    "linkUrl" TEXT,
    "capturedDate" DATE NOT NULL,
    "status" "EvidenceStatus" NOT NULL DEFAULT 'LOGGED',
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EvidenceItem_fileId_key" ON "EvidenceItem"("fileId");

-- CreateIndex
CREATE INDEX "EvidenceItem_userId_capturedDate_idx" ON "EvidenceItem"("userId", "capturedDate");

-- CreateIndex
CREATE INDEX "EvidenceItem_userId_departmentId_idx" ON "EvidenceItem"("userId", "departmentId");

-- CreateIndex
CREATE INDEX "EvidenceItem_submissionId_idx" ON "EvidenceItem"("submissionId");

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceItem" ADD CONSTRAINT "EvidenceItem_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "SubmissionFile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

