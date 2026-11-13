"use client";

import { useState } from "react";
import { Bookmark, ExternalLink, Play } from "lucide-react";
import { recordEngagementAction } from "@/app/(app)/actions";
import { Button } from "@/components/ui/button";
import { isAllowedEmbedUrl } from "@/lib/resources/embed";
import type { WatchResourceView } from "@/lib/resources/service";

const KIND_LABEL: Record<string, string> = {
  VIDEO: "Video", PLAYLIST: "Playlist", DOCUMENTATION: "Documentation", INTERACTIVE: "Interactive", ORIGINAL: "JOKZET Labs", DEMONSTRATION: "Demonstration",
};
const PROVIDER_LABEL: Record<string, string> = {
  youtube: "YouTube", mdn: "MDN", "github-docs": "GitHub Docs", owasp: "OWASP", "aws-docs": "AWS Docs", "microsoft-learn": "Microsoft Learn",
  "google-cloud-docs": "Google Cloud Docs", "python-docs": "Python Docs", "nextjs-docs": "Next.js Docs", "react-docs": "React Docs", w3c: "W3C", "web-dev": "web.dev",
};

/**
 * The WATCH stage: approved instructional resources only. A video plays here only when the learner chooses to (nothing from
 * the video provider loads before that, and only its privacy-enhanced host is ever used); every resource also has an
 * external link as a fallback. Interactions are recorded as advisory hints and never affect progress or credit.
 */
export function WatchPanel({ resources }: { resources: WatchResourceView[] }) {
  const [playing, setPlaying] = useState<Set<string>>(new Set());
  const [bookmarks, setBookmarks] = useState<Record<string, boolean>>(() => Object.fromEntries(resources.map((r) => [r.id, r.bookmarked])));

  // Advisory only: a failed or throttled report must never get in the learner's way.
  const report = (resourceId: string, event: "STARTED" | "EXTERNAL_OPENED" | "BOOKMARKED" | "UNBOOKMARKED") => {
    void recordEngagementAction({ resourceId, event }).catch(() => undefined);
  };

  return (
    <section className="panel p-5" aria-labelledby="watch-heading">
      <p id="watch-heading" className="mono-label">Watch · learn it first</p>
      <ul className="mt-3 space-y-5">
        {resources.map((r) => {
          const canEmbed = !!r.embedUrl && isAllowedEmbedUrl(r.embedUrl);
          const isPlaying = playing.has(r.id);
          const marked = bookmarks[r.id] ?? false;
          return (
            <li key={r.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] text-foreground">{r.title}</p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                    {r.role === "PRIMARY" ? "Start here · " : ""}{KIND_LABEL[r.kind] ?? r.kind}
                    {r.durationMinutes ? ` · ${r.durationMinutes} min` : ""} · {PROVIDER_LABEL[r.provider] ?? r.provider}
                  </p>
                </div>
                <button
                  type="button"
                  aria-pressed={marked}
                  aria-label={marked ? `Remove bookmark for ${r.title}` : `Bookmark ${r.title}`}
                  onClick={() => { setBookmarks((b) => ({ ...b, [r.id]: !marked })); report(r.id, marked ? "UNBOOKMARKED" : "BOOKMARKED"); }}
                  className={`shrink-0 rounded-lg p-1.5 transition-colors ${marked ? "text-primary" : "text-muted-foreground hover:text-foreground"}`}
                >
                  <Bookmark className="h-4 w-4" fill={marked ? "currentColor" : "none"} />
                </button>
              </div>

              {isPlaying && canEmbed ? (
                <div className="mt-3 aspect-video w-full overflow-hidden rounded-xl border border-border bg-secondary">
                  <iframe
                    src={r.embedUrl!}
                    title={r.title}
                    loading="lazy"
                    allowFullScreen
                    allow="encrypted-media; picture-in-picture"
                    referrerPolicy="strict-origin-when-cross-origin"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    className="h-full w-full"
                  />
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {canEmbed && !isPlaying ? (
                  <Button size="sm" onClick={() => { setPlaying((p) => new Set(p).add(r.id)); report(r.id, "STARTED"); }}>
                    <Play className="h-3.5 w-3.5" /> Play here
                  </Button>
                ) : null}
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => report(r.id, "EXTERNAL_OPENED")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-input px-3 text-xs text-foreground transition-colors hover:bg-accent"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> {canEmbed ? "Open on " : "Open "}{PROVIDER_LABEL[r.provider] ?? r.provider}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
        Nothing loads from the video site until you press play. What you open here is only a hint for suggestions; it never changes your progress, XP or assessment.
      </p>
    </section>
  );
}
