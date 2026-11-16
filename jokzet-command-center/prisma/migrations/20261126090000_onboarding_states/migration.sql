-- Additive only: two new onboarding states (a plan is being generated; a generated plan waits for the learner's review).
-- No existing row changes and nothing is dropped.
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'PLAN_GENERATING';
ALTER TYPE "OnboardingStatus" ADD VALUE IF NOT EXISTS 'PLAN_REVIEW';
