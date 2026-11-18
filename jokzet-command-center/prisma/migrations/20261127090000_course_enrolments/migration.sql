-- Additive only: a learner's enrolment in a course (department). Nothing existing is changed or dropped.
-- The generated DDL is followed by a partial unique index and a backfill from existing active or paused plans.

-- CreateEnum
CREATE TYPE "EnrolmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "CourseEnrolment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "status" "EnrolmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "requestKey" TEXT,
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "withdrawnAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseEnrolment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CourseEnrolment_userId_status_idx" ON "CourseEnrolment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrolment_id_userId_key" ON "CourseEnrolment"("id", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseEnrolment_userId_requestKey_key" ON "CourseEnrolment"("userId", "requestKey");

-- AddForeignKey
ALTER TABLE "CourseEnrolment" ADD CONSTRAINT "CourseEnrolment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseEnrolment" ADD CONSTRAINT "CourseEnrolment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- One live (ACTIVE or PAUSED) enrolment per learner and course. A withdrawn or completed one does not block enrolling again.
CREATE UNIQUE INDEX "CourseEnrolment_live_user_department_key" ON "CourseEnrolment"("userId", "departmentId") WHERE "status" IN ('ACTIVE', 'PAUSED');

-- Backfill: a learner with an ACTIVE or PAUSED plan is enrolled in each course that plan covers (idempotent: the NOT EXISTS
-- guard and the partial unique index mean running it twice adds nothing). Learners without a plan (the original fixed
-- programme, drafts in progress) get no rows: the original programme keeps showing every department, and a draft enrols at
-- confirmation.
INSERT INTO "CourseEnrolment" ("id", "userId", "departmentId", "status", "enrolledAt", "updatedAt")
SELECT DISTINCT ON (g."userId", g."departmentId") 'c' || substr(md5(random()::text || g."id"), 1, 24), g."userId", g."departmentId",
       CASE WHEN p."status" = 'PAUSED' THEN 'PAUSED'::"EnrolmentStatus" ELSE 'ACTIVE'::"EnrolmentStatus" END,
       COALESCE(p."activatedAt", p."createdAt"), CURRENT_TIMESTAMP
FROM "LearningGoal" g
JOIN "LearningPlan" p ON p."id" = g."planId" AND p."userId" = g."userId"
WHERE p."status" IN ('ACTIVE', 'PAUSED')
  AND NOT EXISTS (SELECT 1 FROM "CourseEnrolment" e WHERE e."userId" = g."userId" AND e."departmentId" = g."departmentId" AND e."status" IN ('ACTIVE', 'PAUSED'))
ORDER BY g."userId", g."departmentId", (p."status" = 'ACTIVE') DESC;
