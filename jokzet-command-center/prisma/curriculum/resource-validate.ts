import { detectSecrets } from "../../src/lib/evidence/secrets";
import { parseResourceUrl } from "../../src/lib/resources/embed";
import type { MissionResourceSpec, ResourceSpec } from "./resources";

/**
 * Quality gates for the resource catalogue (pure; used by the seed before anything is written, and by the tests).
 * Returns human-readable problems; an empty list means the catalogue is valid.
 */

const KINDS = new Set(["VIDEO", "PLAYLIST", "DOCUMENTATION", "INTERACTIVE", "ORIGINAL", "DEMONSTRATION"]);
const STATUSES = new Set(["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED", "ARCHIVED"]);
const DECISIONS = new Set(["APPROVED", "CHANGES_REQUESTED", "REJECTED"]);
const blank = (v: unknown) => typeof v !== "string" || v.trim() === "";
const validDate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v) && !Number.isNaN(Date.parse(v));

export function resourceProblems(resources: ResourceSpec[], links: MissionResourceSpec[], missionCodes: Set<string>): string[] {
  const p: string[] = [];
  const byCanonical = new Map<string, ResourceSpec>();

  for (const r of resources) {
    const label = r.title ? `"${r.title}"` : r.url;
    const parsed = parseResourceUrl(r.url);
    if (!parsed.ok) {
      p.push(`${label}: ${parsed.error}`);
      continue;
    }
    if (byCanonical.has(parsed.canonicalUrl)) p.push(`${label}: the same resource is listed twice (${parsed.canonicalUrl})`);
    byCanonical.set(parsed.canonicalUrl, r);

    if (blank(r.title) || r.title.length > 200) p.push(`${label}: title is required and at most 200 characters`);
    if (!KINDS.has(r.kind)) p.push(`${label}: unknown kind`);
    if (!STATUSES.has(r.status)) p.push(`${label}: unknown status`);
    if (r.durationMinutes !== undefined && (!Number.isInteger(r.durationMinutes) || r.durationMinutes < 1 || r.durationMinutes > 600)) {
      p.push(`${label}: durationMinutes must be a whole number from 1 to 600`);
    }
    if (r.embeddable && !parsed.embedUrl) p.push(`${label}: only YouTube videos and playlists can be embedded`);
    if (r.embeddable && r.kind !== "VIDEO" && r.kind !== "PLAYLIST") p.push(`${label}: only a VIDEO or PLAYLIST can be embedded`);
    if (r.kind === "PLAYLIST" && parsed.kind !== "playlist") p.push(`${label}: kind PLAYLIST needs a playlist link`);
    if (r.lastVerifiedAt !== undefined && !validDate(r.lastVerifiedAt)) p.push(`${label}: lastVerifiedAt must be a date`);

    if (r.status === "APPROVED") {
      if (blank(r.approvedBy)) p.push(`${label}: an approved resource needs approvedBy`);
      if (!validDate(r.approvedAt)) p.push(`${label}: an approved resource needs approvedAt (a date)`);
      if (blank(r.lastVerifiedAt)) p.push(`${label}: an approved resource needs lastVerifiedAt (when the link was last opened and confirmed)`);
      if (!(r.reviews ?? []).some((x) => x.decision === "APPROVED")) p.push(`${label}: an approved resource needs at least one APPROVED review`);
    }
    for (const review of r.reviews ?? []) {
      if (!DECISIONS.has(review.decision)) p.push(`${label}: a review has an unknown decision`);
      if (blank(review.reviewerName)) p.push(`${label}: every review needs the reviewer's name`);
      if (!validDate(review.at)) p.push(`${label}: every review needs a date`);
    }
    const text = [r.title, r.licenceNote ?? "", ...(r.reviews ?? []).map((x) => x.note ?? "")].join("\n");
    if (detectSecrets(text).length) p.push(`${label}: text contains something that looks like a secret`);
  }

  const seen = new Set<string>();
  const primaries = new Map<string, number>();
  for (const l of links) {
    const parsed = parseResourceUrl(l.url);
    const label = `${l.missionCode} -> ${l.url}`;
    if (!missionCodes.has(l.missionCode)) p.push(`${label}: unknown mission code`);
    if (!parsed.ok) {
      p.push(`${label}: ${parsed.error}`);
      continue;
    }
    if (!byCanonical.has(parsed.canonicalUrl)) p.push(`${label}: the resource is not listed in the catalogue`);
    if (l.role !== "PRIMARY" && l.role !== "SUPPLEMENTARY") p.push(`${label}: role must be PRIMARY or SUPPLEMENTARY`);
    const key = `${l.missionCode}|${parsed.canonicalUrl}`;
    if (seen.has(key)) p.push(`${label}: linked twice`);
    seen.add(key);
    if (l.role === "PRIMARY") primaries.set(l.missionCode, (primaries.get(l.missionCode) ?? 0) + 1);
  }
  for (const [code, n] of primaries) if (n > 1) p.push(`${code}: has ${n} PRIMARY resources, at most one is allowed`);
  return p;
}

export function assertValidResources(resources: ResourceSpec[], links: MissionResourceSpec[], missionCodes: Set<string>): void {
  const problems = resourceProblems(resources, links, missionCodes);
  if (problems.length) throw new Error(`Resource catalogue failed validation, nothing was seeded:\n - ${problems.join("\n - ")}`);
}
