import { db } from "@/lib/db";
import { detectSecrets, detectSecretInUrl } from "@/lib/evidence/secrets";
import { getStorage } from "@/lib/storage";
import type { ContentPart } from "./provider";

/**
 * The controlled evidence package for one submission. It contains ONLY what this learner attached to THIS submission:
 * their written explanation, text or code files, and (for a model that can see) images. Each piece gets a short reference
 * (E1, E2, ...) that the assessor must cite. Links are listed but are NOT inspected: a URL alone is not evidence of
 * inspection, and the server never fetches a learner-supplied address. Anything that looks like a secret is withheld.
 */
export type PackageItem =
  | { ref: string; kind: "ANSWER"; text: string }
  | { ref: string; kind: "TEXT"; name: string; text: string; truncated: boolean }
  | { ref: string; kind: "IMAGE"; name: string }
  | { ref: string; kind: "NOT_INSPECTED"; name: string; reason: string };

export type EvidencePackage = {
  items: PackageItem[];
  links: { label: string; url: string; note: string }[];
  images: { ref: string; dataUrl: string }[];
  refs: Set<string>;
  inspectable: number; // pieces the assessor can actually read or see (besides the written answer)
  notes: string[];
};

const MAX_TEXT_BYTES = 48 * 1024; // per text file
const MAX_TOTAL_TEXT = 160 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGES = 6;

async function readAll(stream: ReadableStream<Uint8Array>, cap: number): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Buffer[] = [];
  let size = 0;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(Buffer.from(value));
    if (size > cap) {
      await reader.cancel();
      break;
    }
  }
  return Buffer.concat(chunks).subarray(0, cap);
}

export async function buildEvidencePackage(userId: string, submissionId: string, opts: { vision: boolean }): Promise<EvidencePackage | null> {
  // The submission must belong to this learner; evidence is read only through it, never by an id from outside.
  const submission = await db.submission.findFirst({
    where: { id: submissionId, userId },
    include: { evidence: { where: { userId }, include: { file: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!submission) return null;

  const items: PackageItem[] = [];
  const links: EvidencePackage["links"] = [];
  const images: EvidencePackage["images"] = [];
  const notes: string[] = [];
  let n = 0;
  const ref = () => `E${++n}`;
  let inspectable = 0;
  let totalText = 0;

  const answer = (submission.explanation ?? "").trim();
  if (answer) {
    if (detectSecrets(answer).length) notes.push("The written explanation looks like it contains a secret, so it was withheld.");
    else items.push({ ref: "ANSWER", kind: "ANSWER", text: answer.slice(0, 8000) });
  }

  for (const u of [["Repository link", submission.githubUrl], ["Live site link", submission.liveUrl]] as const) {
    if (u[1] && !detectSecretInUrl(u[1])) links.push({ label: u[0], url: u[1], note: "Listed only. The content behind this link was NOT retrieved or inspected." });
  }

  const storage = getStorage();
  for (const e of submission.evidence) {
    if (e.linkUrl && !detectSecretInUrl(e.linkUrl)) links.push({ label: e.title.slice(0, 80), url: e.linkUrl, note: "Listed only. The content behind this link was NOT retrieved or inspected." });
    // A written account the learner added to the evidence is learner text like any other: included unless it looks like a secret.
    const written = (e.description ?? "").trim();
    if (written && totalText + written.length <= MAX_TOTAL_TEXT) {
      if (detectSecrets(written).length) notes.push(`The written note on "${e.title.slice(0, 60)}" looks like it contains a secret, so it was withheld.`);
      else {
        items.push({ ref: ref(), kind: "TEXT", name: `Note: ${e.title.slice(0, 60)}`, text: written.slice(0, 8000), truncated: written.length > 8000 });
        totalText += written.length;
        inspectable += 1;
      }
    }
    const f = e.file;
    if (!f) continue;
    const r = ref();
    if (f.kind === "CODE") {
      const obj = await storage.get(f.storageKey);
      if (!obj) { items.push({ ref: r, kind: "NOT_INSPECTED", name: f.originalName, reason: "The file could not be read." }); continue; }
      const raw = await readAll(obj.stream, MAX_TEXT_BYTES + 1);
      const truncated = raw.length > MAX_TEXT_BYTES || obj.size > MAX_TEXT_BYTES;
      const text = raw.subarray(0, MAX_TEXT_BYTES).toString("utf8");
      if (detectSecrets(text).length) { items.push({ ref: r, kind: "NOT_INSPECTED", name: f.originalName, reason: "Withheld because it appears to contain a secret." }); continue; }
      if (totalText + text.length > MAX_TOTAL_TEXT) { items.push({ ref: r, kind: "NOT_INSPECTED", name: f.originalName, reason: "Not included: the package size limit was reached." }); continue; }
      totalText += text.length;
      items.push({ ref: r, kind: "TEXT", name: f.originalName, text, truncated });
      inspectable += 1;
    } else if ((f.kind === "IMAGE" || f.kind === "SCREENSHOT") && opts.vision && images.length < MAX_IMAGES && f.sizeBytes <= MAX_IMAGE_BYTES) {
      const obj = await storage.get(f.storageKey);
      if (!obj) { items.push({ ref: r, kind: "NOT_INSPECTED", name: f.originalName, reason: "The file could not be read." }); continue; }
      const raw = await readAll(obj.stream, MAX_IMAGE_BYTES);
      images.push({ ref: r, dataUrl: `data:${f.mimeType};base64,${raw.toString("base64")}` });
      items.push({ ref: r, kind: "IMAGE", name: f.originalName });
      inspectable += 1;
    } else {
      items.push({ ref: r, kind: "NOT_INSPECTED", name: f.originalName, reason: f.kind === "PDF" || f.kind === "VIDEO" ? `${f.kind === "PDF" ? "PDF" : "Video"} files are not inspected automatically.` : "This file type or size cannot be assessed automatically." });
    }
  }

  return { items, links, images, refs: new Set(items.map((i) => i.ref)), inspectable, notes };
}

/** The image parts for the message, in the same order as `images`. Only built when the chosen model can see. */
export const imageParts = (pkg: EvidencePackage): ContentPart[] => pkg.images.map((i) => ({ type: "image_url" as const, image_url: { url: i.dataUrl } }));
