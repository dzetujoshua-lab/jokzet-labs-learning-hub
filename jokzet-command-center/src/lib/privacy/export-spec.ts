/**
 * What a learner's data export contains. Every Prisma model must be listed in exactly one of EXPORTED, SHARED or EXCLUDED;
 * `tests/data-export.test.ts` parses prisma/schema.prisma and fails when a model is in none of them, so a new table cannot be
 * left out of the export (or leaked into it) without a deliberate decision.
 *
 * Pure data, no database access: safe to import from tests.
 */

type Where = (userId: string) => Record<string, unknown>;

export type ExportSpec = {
  /** Key in the export file. */
  key: string;
  /** Prisma model name (as in schema.prisma). */
  model: string;
  /** Prisma client delegate name. */
  delegate: string;
  /** Rows belonging to this user. */
  where: Where;
  /** Columns left out because they are credentials or storage internals, never personal content. */
  omit?: Record<string, true>;
};

const own: Where = (userId) => ({ userId });

export const EXPORTED: ExportSpec[] = [
  { key: "profile", model: "Profile", delegate: "profile", where: own },
  { key: "sessions", model: "Session", delegate: "session", where: own, omit: { tokenHash: true } },
  { key: "learnerDepartments", model: "LearnerDepartment", delegate: "learnerDepartment", where: own },
  { key: "learnerMissions", model: "LearnerMission", delegate: "learnerMission", where: own },
  { key: "customMissions", model: "Mission", delegate: "mission", where: (userId) => ({ createdById: userId }) },
  { key: "submissions", model: "Submission", delegate: "submission", where: own },
  { key: "submissionFiles", model: "SubmissionFile", delegate: "submissionFile", where: own, omit: { storageKey: true } },
  { key: "assessments", model: "Assessment", delegate: "assessment", where: own },
  { key: "assessmentScores", model: "AssessmentScore", delegate: "assessmentScore", where: (userId) => ({ assessment: { userId } }) },
  { key: "feedback", model: "Feedback", delegate: "feedback", where: (userId) => ({ OR: [{ authorId: userId }, { assessment: { userId } }] }) },
  { key: "assessmentReviews", model: "AssessmentReview", delegate: "assessmentReview", where: own },
  { key: "assessmentReviewScores", model: "AssessmentReviewScore", delegate: "assessmentReviewScore", where: (userId) => ({ review: { userId } }) },
  { key: "reviewRequests", model: "ReviewRequest", delegate: "reviewRequest", where: own },
  { key: "reviewerScopes", model: "ReviewerScope", delegate: "reviewerScope", where: own },
  { key: "evidenceAccessLog", model: "EvidenceAccessLog", delegate: "evidenceAccessLog", where: (userId) => ({ learnerId: userId }) },
  { key: "skills", model: "UserSkill", delegate: "userSkill", where: own },
  { key: "skillCompetencies", model: "SkillCompetency", delegate: "skillCompetency", where: own },
  { key: "achievements", model: "UserAchievement", delegate: "userAchievement", where: own },
  { key: "activity", model: "ActivityRecord", delegate: "activityRecord", where: own },
  { key: "activityRecommendations", model: "ActivityRecommendation", delegate: "activityRecommendation", where: own },
  { key: "resourceEngagements", model: "ResourceEngagement", delegate: "resourceEngagement", where: own },
  { key: "reminders", model: "Reminder", delegate: "reminder", where: own },
  { key: "reminderSettings", model: "ReminderSettings", delegate: "reminderSettings", where: own },
  { key: "notifications", model: "Notification", delegate: "notification", where: own },
  { key: "notificationDeliveries", model: "NotificationDelivery", delegate: "notificationDelivery", where: (userId) => ({ notification: { userId } }) },
  // The push endpoint and keys are credentials for sending to the browser; only the fact of a subscription is exported.
  { key: "pushSubscriptions", model: "PushSubscription", delegate: "pushSubscription", where: own, omit: { endpoint: true, p256dh: true, auth: true } },
  { key: "scheduleConfigs", model: "ScheduleConfig", delegate: "scheduleConfig", where: own },
  { key: "weeklyMissionTemplates", model: "WeeklyMissionTemplate", delegate: "weeklyMissionTemplate", where: (userId) => ({ schedule: { userId } }) },
  { key: "dailyMissions", model: "DailyMissionInstance", delegate: "dailyMissionInstance", where: own },
  { key: "completionRecords", model: "MissionCompletionRecord", delegate: "missionCompletionRecord", where: own },
  { key: "portfolioProjects", model: "PortfolioProject", delegate: "portfolioProject", where: own },
  { key: "capstones", model: "CapstoneProject", delegate: "capstoneProject", where: own },
  { key: "capstoneMilestones", model: "CapstoneMilestone", delegate: "capstoneMilestone", where: (userId) => ({ capstone: { userId } }) },
  { key: "evidenceItems", model: "EvidenceItem", delegate: "evidenceItem", where: own },
  { key: "businessCustomers", model: "BosCustomer", delegate: "bosCustomer", where: own },
  { key: "businessSuppliers", model: "BosSupplier", delegate: "bosSupplier", where: own },
  { key: "businessProducts", model: "BosProduct", delegate: "bosProduct", where: own },
  { key: "businessSales", model: "BosSale", delegate: "bosSale", where: own },
  { key: "businessSaleItems", model: "BosSaleItem", delegate: "bosSaleItem", where: (userId) => ({ sale: { userId } }) },
  { key: "businessStockMovements", model: "BosStockMovement", delegate: "bosStockMovement", where: (userId) => ({ product: { userId } }) },
  { key: "businessExpenses", model: "BosExpense", delegate: "bosExpense", where: own },
  { key: "learningPlans", model: "LearningPlan", delegate: "learningPlan", where: own },
  { key: "learningGoals", model: "LearningGoal", delegate: "learningGoal", where: own },
  { key: "baselineAssessments", model: "BaselineAssessment", delegate: "baselineAssessment", where: own },
  { key: "planPhases", model: "LearningPlanPhase", delegate: "learningPlanPhase", where: own },
  { key: "planItems", model: "LearningPlanItem", delegate: "learningPlanItem", where: own },
  { key: "planEvents", model: "LearningPlanEvent", delegate: "learningPlanEvent", where: own },
  { key: "roleChanges", model: "RoleAudit", delegate: "roleAudit", where: (userId) => ({ targetUserId: userId }), omit: { actor: true } }, // the actor is an operator's machine account, not the learner's data
];

/** Curriculum and reference data that is the same for everyone: not personal data, so not exported. */
export const SHARED = [
  "Department", "LearningPath", "Level", "Skill", "MissionSkill", "MissionStep", "Resource", "AssessmentRubric", "RubricCriterion",
  "Achievement", "LearningResource", "MissionResource", "ResourceReview",
] as const;

/** Deliberately not exported, with the reason. */
export const EXCLUDED: Record<string, string> = {
  User: "Exported separately as `account`, without the password hash and sign-in counters.",
  RateLimitBucket: "Hashed counters with no personal content; they expire within a day.",
};

/** Things the export deliberately leaves out, written into the file so the reader knows. */
export const EXPORT_NOTES = [
  "Your password is stored only as a one-way hash and is not included.",
  "Session tokens, push-notification endpoints and keys, and internal file storage keys are credentials and are not included.",
  "Uploaded evidence files are listed (name, type, size, checksum) but the file contents are not part of this JSON export.",
  "Work you did as a reviewer on other learners' submissions is about other people and is not included.",
  "Curriculum content (missions, rubrics, resources) is shared by everyone and is not your personal data.",
];
