/**
 * Placement from a baseline result. A baseline is self-assessed, so placement is advisory: it may skip CONTENT, never
 * CREDIT (a baseline earns no XP, no skills and never counts as earned work).
 *  - below 40%: Level 0 with a foundation review first
 *  - 40 to 69%: Level 0
 *  - 70% and above: the next published level, otherwise the highest published one
 */
export type Placement = { level: number; foundationReview: boolean };

export function placementFromPercentage(percentage: number, publishedLevels: number[]): Placement {
  const p = Math.min(100, Math.max(0, Math.round(percentage)));
  const levels = [...new Set([0, ...publishedLevels])].sort((a, b) => a - b);
  if (p < 40) return { level: 0, foundationReview: true };
  if (p < 70) return { level: 0, foundationReview: false };
  const next = levels.find((l) => l > 0);
  return { level: next ?? levels[levels.length - 1], foundationReview: false };
}
