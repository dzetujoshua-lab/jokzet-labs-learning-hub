/**
 * The approved instructional-resource catalogue (WATCH), as reviewed code.
 *
 * Rules (enforced by prisma/curriculum/validate.ts before the seed writes anything):
 *  - Links are https, on an approved host, and never invented: every entry here must be a real resource that a named
 *    reviewer has opened and approved. Approval is recorded in the entry (approvedBy, approvedAt, a review) and the pull
 *    request that adds it is the approval record.
 *  - A status of APPROVED needs approvedBy, approvedAt and at least one APPROVED review.
 *  - A mission has at most one PRIMARY resource; MISSION_RESOURCES says which resource teaches which mission.
 *
 * This file is intentionally EMPTY today: no resource has been verified yet. Until entries exist, missions show an honest
 * "no approved resource yet" notice and the plan generator reports it as a curriculum shortfall.
 */

export type ResourceSpec = {
  url: string;
  kind: "VIDEO" | "PLAYLIST" | "DOCUMENTATION" | "INTERACTIVE" | "ORIGINAL" | "DEMONSTRATION";
  title: string;
  durationMinutes?: number;
  language?: string;
  level?: string;
  embeddable?: boolean; // true only for YouTube videos and playlists that allow embedding
  status: "DRAFT" | "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "ARCHIVED";
  approvedBy?: string;
  approvedAt?: string; // ISO date
  lastVerifiedAt?: string; // ISO date: when someone last opened the link and confirmed it works
  licenceNote?: string;
  reviews?: { reviewerName: string; decision: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED"; note?: string; at: string }[];
};

export type MissionResourceSpec = {
  missionCode: string;
  url: string; // must match a ResourceSpec (after canonicalisation)
  role: "PRIMARY" | "SUPPLEMENTARY";
  position?: number;
};

export const RESOURCES: ResourceSpec[] = [];

export const MISSION_RESOURCES: MissionResourceSpec[] = [];
