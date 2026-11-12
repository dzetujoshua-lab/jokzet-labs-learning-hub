import { Camera, ExternalLink, FileText } from "lucide-react";
import { DeptGlyph } from "@/components/dashboard/dept-glyph";
import { metaFor } from "@/lib/programme";
import type { EvidenceView } from "@/lib/evidence/service";

/**
 * Evidence preview, same 16:10 frame and fallback card as the Base44 EvidenceMedia. Files are always loaded through the
 * authenticated owner-only route (/api/evidence/:id/file); nothing is ever served from a public path.
 */
export function EvidenceMedia({ item }: { item: Pick<EvidenceView, "id" | "title" | "kind" | "departmentCode" | "fileName" | "fileKind" | "linkUrl"> }) {
  const meta = metaFor(item.departmentCode);
  const src = `/api/evidence/${item.id}/file`;

  if (item.fileKind === "IMAGE") {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element -- authenticated stream, not an optimisable static asset */}
        <img src={src} alt={item.title} loading="lazy" className="h-full w-full object-cover" />
      </div>
    );
  }
  if (item.fileKind === "VIDEO") {
    return (
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-secondary">
        <video src={src} controls preload="metadata" className="h-full w-full object-contain" aria-label={item.title} />
      </div>
    );
  }

  const Icon = item.kind === "Photo" || item.kind === "Video" ? Camera : FileText;
  return (
    <div className="relative flex aspect-[16/10] w-full flex-col justify-between bg-secondary/60 p-4">
      <Icon className="h-5 w-5" strokeWidth={1.5} style={{ color: meta.color }} />
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {item.fileName || item.linkUrl || item.kind}
        </span>
        {item.fileKind ? (
          <a href={`${src}?download=1`} aria-label={`Download ${item.fileName ?? item.title}`} className="shrink-0 text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : item.linkUrl ? (
          <a href={item.linkUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open ${item.title}`} className="shrink-0 text-muted-foreground hover:text-foreground">
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : (
          <DeptGlyph icon={meta.icon} className="h-3.5 w-3.5" />
        )}
      </div>
    </div>
  );
}
