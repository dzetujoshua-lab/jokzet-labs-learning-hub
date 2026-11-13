-- A learner's reviews are removed with the learner (account deletion keeps working); the reviewer side is SET NULL with a label snapshot.
-- AddForeignKey
ALTER TABLE "AssessmentReview" ADD CONSTRAINT "AssessmentReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

