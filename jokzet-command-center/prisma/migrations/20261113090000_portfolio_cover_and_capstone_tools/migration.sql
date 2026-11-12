-- AlterTable
ALTER TABLE "CapstoneProject" ADD COLUMN     "tools" TEXT[];

-- AlterTable
ALTER TABLE "PortfolioProject" ADD COLUMN     "coverEvidenceId" TEXT;

-- AddForeignKey
ALTER TABLE "PortfolioProject" ADD CONSTRAINT "PortfolioProject_coverEvidenceId_fkey" FOREIGN KEY ("coverEvidenceId") REFERENCES "EvidenceItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

