import { createHash, randomBytes } from "node:crypto";
import { detectSecrets, secretMessage } from "./secrets";

export type StoredKind = "IMAGE" | "VIDEO" | "PDF" | "CODE";

export const MAX_BYTES: Record<StoredKind, number> = {
  IMAGE: 10 * 1024 * 1024,
  PDF: 20 * 1024 * 1024,
  VIDEO: 50 * 1024 * 1024,
  CODE: 1024 * 1024,
};
export const MAX_USER_STORAGE_BYTES = 500 * 1024 * 1024; // per-account quota

const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);
// Plain-text source and notes only. Scripts are stored and served as inert text/plain downloads, never executed.
const CODE_EXT = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".py", ".html", ".css", ".json", ".md", ".txt", ".sh", ".sql", ".java", ".c", ".cpp", ".h",
  ".go", ".rs", ".php", ".rb", ".yml", ".yaml", ".toml", ".xml", ".ini", ".log", ".csv", ".conf",
]);
const FORBIDDEN_NAMES = /^(\.env(\..*)?|.*\.(pem|key|p12|pfx|ppk|kdbx)|id_rsa|id_ed25519)$/i;

export type FileCheck =
  | { ok: true; kind: StoredKind; mime: string; ext: string; safeName: string; sha256: string; size: number }
  | { ok: false; error: string };

const startsWith = (b: Buffer, bytes: number[], offset = 0) => bytes.every((v, i) => b[offset + i] === v);
const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString("latin1");

/** Identifies the real file type from its bytes. The client-supplied type and extension are never trusted on their own. */
function sniff(b: Buffer): { kind: StoredKind; mime: string; exts: string[] } | null {
  if (b.length >= 8 && startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { kind: "IMAGE", mime: "image/png", exts: [".png"] };
  if (b.length >= 3 && startsWith(b, [0xff, 0xd8, 0xff])) return { kind: "IMAGE", mime: "image/jpeg", exts: [".jpg", ".jpeg"] };
  if (b.length >= 6 && /^GIF8[79]a$/.test(ascii(b, 0, 6))) return { kind: "IMAGE", mime: "image/gif", exts: [".gif"] };
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return { kind: "IMAGE", mime: "image/webp", exts: [".webp"] };
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return { kind: "PDF", mime: "application/pdf", exts: [".pdf"] };
  if (b.length >= 12 && ascii(b, 4, 8) === "ftyp") return { kind: "VIDEO", mime: "video/mp4", exts: [".mp4", ".mov"] };
  if (b.length >= 4 && startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return { kind: "VIDEO", mime: "video/webm", exts: [".webm"] };
  return null;
}

function isCleanText(b: Buffer): string | null {
  if (b.includes(0)) return null; // NUL byte = binary
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return null;
  }
}

export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "").replace(/^\.+/, "").trim().slice(-120);
  return cleaned || "file";
}

const extOf = (name: string) => {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(i).toLowerCase() : "";
};

/**
 * Validates an upload: forbidden names, extension allow-list, real type from content, size limits, text sanity and
 * secret scanning for code/text. SVG, HTML-as-image, executables and archives are all rejected.
 */
export function checkUpload(originalName: string, data: Buffer): FileCheck {
  const safeName = sanitizeFileName(originalName);
  const ext = extOf(safeName);
  if (data.length === 0) return { ok: false, error: "The file is empty." };
  // Test the RAW name too: sanitising strips leading dots, which would turn ".env" into "env" and hide it.
  const rawName = originalName.split(/[\\/]/).pop() ?? "";
  if (FORBIDDEN_NAMES.test(rawName) || FORBIDDEN_NAMES.test(safeName)) return { ok: false, error: "Key files and .env files cannot be stored as evidence." };
  if (!ext) return { ok: false, error: "The file needs an extension such as .png, .pdf, .mp4 or .js." };

  const sniffed = sniff(data);
  let kind: StoredKind;
  let mime: string;

  if (sniffed) {
    kind = sniffed.kind;
    mime = sniffed.mime;
    const allowed = kind === "IMAGE" ? IMAGE_EXT : kind === "VIDEO" ? VIDEO_EXT : new Set([".pdf"]);
    if (!allowed.has(ext) || !sniffed.exts.includes(ext)) return { ok: false, error: `The file contents are ${mime}, which does not match the ${ext} extension.` };
  } else {
    if (IMAGE_EXT.has(ext) || VIDEO_EXT.has(ext) || ext === ".pdf") return { ok: false, error: `The file contents are not a valid ${ext} file.` };
    if (!CODE_EXT.has(ext)) return { ok: false, error: `Files of type ${ext} are not allowed. Use an image, PDF, video, or a plain-text/code file.` };
    kind = "CODE";
    mime = "text/plain";
  }

  if (data.length > MAX_BYTES[kind]) {
    return { ok: false, error: `That file is too large. The limit for this type is ${Math.round(MAX_BYTES[kind] / 1024 / 1024)} MB.` };
  }
  if (kind === "CODE") {
    const text = isCleanText(data);
    if (text === null) return { ok: false, error: "Code and text files must be plain UTF-8 text." };
    const found = detectSecrets(text);
    if (found.length) return { ok: false, error: secretMessage(found) };
  }
  return { ok: true, kind, mime, ext, safeName, sha256: createHash("sha256").update(data).digest("hex"), size: data.length };
}

/** A new random, opaque storage key. */
export const newStorageKey = () => randomBytes(16).toString("hex");
