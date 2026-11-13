import type { NextRequest } from "next/server";
import { json } from "@/lib/http";
import { getStorage } from "@/lib/storage";

type StoredFile = { kind: string; mimeType: string; sizeBytes: number; storageKey: string; originalName: string };

/**
 * Streams a stored evidence file. Callers decide WHO may see it (the owner, or a reviewer on a claimed request) before
 * calling this. Content type comes from the server's own sniffing at upload time; only images and video render inline,
 * everything else is a download. nosniff, a locked-down CSP and a private, no-store cache policy keep uploaded content
 * inert and out of shared caches.
 */
export async function streamEvidenceFile(request: NextRequest, file: StoredFile): Promise<Response> {
  const inline = file.kind === "IMAGE" || file.kind === "VIDEO";
  const forceDownload = request.nextUrl.searchParams.get("download") === "1";
  const contentType = file.kind === "CODE" ? "text/plain; charset=utf-8" : file.mimeType;

  let range: { start: number; end: number } | undefined;
  let status = 200;
  const header = request.headers.get("range");
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header) : null;
  if (match && file.kind === "VIDEO") {
    const size = file.sizeBytes;
    const start = match[1] === "" ? Math.max(size - Number(match[2]), 0) : Number(match[1]);
    const end = match[2] === "" || match[1] === "" ? size - 1 : Math.min(Number(match[2]), size - 1);
    if (!(start >= 0 && start <= end && start < size)) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    range = { start, end };
    status = 206;
  }

  const object = await getStorage().get(file.storageKey, range);
  if (!object) return json({ error: "Not found" }, 404);

  const length = range ? range.end - range.start + 1 : object.size;
  const headers: Record<string, string> = {
    "Content-Type": contentType,
    "Content-Length": String(length),
    "Content-Disposition": `${inline && !forceDownload ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file.originalName)}`,
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Cache-Control": "private, no-store",
    "Accept-Ranges": file.kind === "VIDEO" ? "bytes" : "none",
  };
  if (range) headers["Content-Range"] = `bytes ${range.start}-${range.end}/${object.size}`;
  return new Response(object.stream, { status, headers });
}
