/**
 * Deterministic recommendation rules (pure, no database, no AI). The same inputs always give the same offers.
 *
 * A recommended challenge is optional extra practice derived from an approved curriculum mission the learner has
 * already worked on, for one of two reasons:
 *   OPEN_CORRECTION: an unresolved correction from an assessment of that mission;
 *   WEAK_CRITERION:  an assessment of that mission flagged weak criteria (even when it passed).
 * Only approved, published curriculum missions are ever offered, at most one offer per source mission ever (a dismissed
 * one is not re-offered), and at most `maxOpen` offers are open at a time.
 */

export type AssessmentFact = {
  id: string;
  assessedAt: Date;
  missionId: string;
  missionTitle: string;
  weaknesses: string[];
};

export type CorrectionFact = {
  assessmentId: string;
  assessedAt: Date;
  missionId: string;
  missionTitle: string;
};

export type Candidate = {
  missionId: string;
  reasonCode: "OPEN_CORRECTION" | "WEAK_CRITERION";
  reasonDetail: string;
  sourceAssessmentId: string;
};

export const MAX_OPEN_RECOMMENDATIONS = 5;

export function deriveRecommendations(input: {
  assessments: AssessmentFact[];
  openCorrections: CorrectionFact[];
  /** Missions that already have a recommendation in any status (offered, accepted or dismissed). */
  alreadyRecommended: Set<string>;
  openOffers: number;
  maxOpen?: number;
}): Candidate[] {
  const max = input.maxOpen ?? MAX_OPEN_RECOMMENDATIONS;
  const slots = Math.max(0, max - input.openOffers);
  if (slots === 0) return [];

  const out: Candidate[] = [];
  const seen = new Set(input.alreadyRecommended);
  const take = (c: Candidate) => {
    if (seen.has(c.missionId)) return;
    seen.add(c.missionId);
    out.push(c);
  };

  // Unresolved corrections first (the learner was explicitly told to fix something), newest first.
  for (const c of [...input.openCorrections].sort((a, b) => b.assessedAt.getTime() - a.assessedAt.getTime() || a.assessmentId.localeCompare(b.assessmentId))) {
    take({
      missionId: c.missionId,
      reasonCode: "OPEN_CORRECTION",
      reasonDetail: `You still have an unresolved correction on "${c.missionTitle}".`,
      sourceAssessmentId: c.assessmentId,
    });
  }
  // Then weak criteria from assessments, newest first.
  for (const a of [...input.assessments].sort((x, y) => y.assessedAt.getTime() - x.assessedAt.getTime() || x.id.localeCompare(y.id))) {
    if (!a.weaknesses.length) continue;
    take({
      missionId: a.missionId,
      reasonCode: "WEAK_CRITERION",
      reasonDetail: `Your assessment of "${a.missionTitle}" flagged: ${a.weaknesses.join(", ")}.`,
      sourceAssessmentId: a.id,
    });
  }
  return out.slice(0, slots);
}
