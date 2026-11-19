import type { Metadata } from "next";
import { ProviderCheckButton } from "@/components/admin/admin-actions";
import { RerunButton } from "@/components/reviews/rerun-button";
import { getAiCentre } from "@/lib/admin/ai-centre";
import { requireRole } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Administration Centre · AI Assessment Centre" };

const STATUS_TONE: Record<string, string> = {
  AI_COMPLETE: "text-[hsl(var(--admin-teal))]", NEEDS_HUMAN_REVIEW: "text-[hsl(var(--admin-amber))]", RETRY_PENDING: "text-[hsl(var(--admin-amber))]", FAILED: "text-destructive",
};
const when = (d: Date) => d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });
const nice = (s: string) => s.toLowerCase().replace(/_/g, " ");

function Tile({ label, value, note, tone }: { label: string; value: number | string; note: string; tone: string }) {
  return (
    <div className={`kpi ${tone} p-4`}>
      <p className="text-[12px] text-foreground/85">{label}</p>
      <p className="mt-2 font-display text-[28px] font-semibold leading-none tabular-nums text-foreground">{value}</p>
      <p className="mt-2 text-[11px] leading-snug text-muted-foreground">{note}</p>
    </div>
  );
}

export default async function AiCentrePage() {
  const user = await requireRole("ADMIN");
  const res = await getAiCentre(user.id);
  if (!res.ok) return null;
  const c = res.centre;
  const s = c.settings;
  return (
    <div className="space-y-5">
      <header>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--admin-cyan))]">Administration Centre</p>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight text-foreground">AI Assessment Centre</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">What the AI assessor is doing, what it is set to, and whether the provider answers. The AI never produces a score when it fails: stopped work goes to a person.</p>
      </header>

      <section aria-label="Job states" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Tile label="Processing" value={c.counts.processing} note="queued or being scored" tone="kpi-blue" />
        <Tile label="Waiting to retry" value={c.counts.retrying} note="will try again by itself" tone="kpi-amber" />
        <Tile label="Completed" value={c.counts.complete} note="scored, not yet confirmed by a reviewer" tone="kpi-teal" />
        <Tile label="Scored, for review" value={c.counts.scoredForReview} note="a person checks the result" tone="kpi-violet" />
        <Tile label="Stopped" value={c.counts.stopped} note="no score; needs a person or a re-run" tone="kpi-cyan" />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="glass p-5" aria-labelledby="settings-h">
          <h2 id="settings-h" className="font-display text-sm text-foreground">Provider and settings</h2>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div><dt className="text-[11px] text-muted-foreground">AI assessment</dt><dd className={s.enabled ? "text-[hsl(var(--admin-teal))]" : "text-[hsl(var(--admin-amber))]"}>{s.enabled ? "Switched on" : "Switched off"}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Provider</dt><dd className="text-foreground">{s.provider === "gemini" ? "Google Gemini" : "DeepSeek"}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Model</dt><dd className="text-foreground">{s.model}{s.advancedModel ? ` (large work: ${s.advancedModel})` : ""}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">API key</dt><dd className="text-foreground">{s.keyPresent ? "Present (never shown)" : "Not set"}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Time limit · attempts</dt><dd className="text-foreground">{s.timeoutSeconds} s · {s.maxAttempts}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Daily limits</dt><dd className="text-foreground">{s.userDailyLimit} per learner · {s.globalDailyLimit} overall</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Sent to a reviewer below</dt><dd className="text-foreground">{s.minConfidencePercent}% confidence</dd></div>
          </dl>
          <div className="mt-5 border-t border-border/60 pt-4"><ProviderCheckButton /></div>
          <p className="mt-3 text-[11px] text-muted-foreground">Settings are changed in the hosting environment, not here.</p>
        </section>

        <section className="glass p-5" aria-labelledby="usage-h">
          <h2 id="usage-h" className="font-display text-sm text-foreground">Usage, last {c.usage.days} days</h2>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div><dt className="text-[11px] text-muted-foreground">Jobs</dt><dd className="font-display text-xl tabular-nums text-foreground">{c.usage.jobs}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Tokens in</dt><dd className="font-display text-xl tabular-nums text-foreground">{c.usage.tokensIn.toLocaleString("en-GB")}</dd></div>
            <div><dt className="text-[11px] text-muted-foreground">Tokens out</dt><dd className="font-display text-xl tabular-nums text-foreground">{c.usage.tokensOut.toLocaleString("en-GB")}</dd></div>
          </dl>
          <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Cost is not estimated: the Academy has no price stored for the provider, and a made-up price would be a made-up cost. Check the provider&apos;s own billing page for what was charged.</p>
        </section>
      </div>

      <section className="glass overflow-hidden" aria-labelledby="problems-h">
        <div className="border-b border-border/60 px-5 py-4">
          <h2 id="problems-h" className="font-display text-sm text-foreground">Stopped on a provider problem · {c.problems.length}</h2>
          <p className="mt-1 text-xs text-muted-foreground">Waiting ones retry by themselves. For the others, fix the cause (for example the provider balance), then re-run.</p>
        </div>
        {c.problems.length ? (
          <ul>
            {c.problems.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/60 px-5 py-3 last:border-0">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{p.missionCode ?? "·"}</span>
                <span className="min-w-0 flex-1 text-sm text-foreground">{p.missionTitle}</span>
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{nice(p.code)} · {when(p.createdAt)}</span>
                {p.parked ? <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[hsl(var(--admin-cyan))]">Waiting, retrying</span> : <RerunButton jobId={p.id} />}
              </li>
            ))}
          </ul>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">Nothing is stopped on a provider problem.</p>}
      </section>

      <section className="glass overflow-hidden" aria-labelledby="recent-h">
        <div className="border-b border-border/60 px-5 py-4"><h2 id="recent-h" className="font-display text-sm text-foreground">Recent jobs · {c.recent.length} of {c.counts.total}</h2></div>
        {c.recent.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead><tr className="text-muted-foreground"><th className="px-5 py-2 font-normal">Lesson</th><th className="px-3 py-2 font-normal">State</th><th className="px-3 py-2 font-normal">Tries</th><th className="px-3 py-2 font-normal">Model</th><th className="px-3 py-2 font-normal">Confidence</th><th className="px-3 py-2 font-normal">Tokens</th><th className="px-5 py-2 font-normal">When</th></tr></thead>
              <tbody>
                {c.recent.map((j) => (
                  <tr key={j.id} className="border-t border-border/60">
                    <td className="max-w-[16rem] truncate px-5 py-2.5 text-foreground">{j.lesson}</td>
                    <td className={`px-3 py-2.5 ${STATUS_TONE[j.status] ?? "text-foreground"}`}>{nice(j.status)}{j.code ? ` · ${nice(j.code)}` : ""}</td>
                    <td className="px-3 py-2.5 tabular-nums text-foreground">{j.attempts}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{j.model ?? "·"}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{j.confidencePercent === null ? "·" : `${j.confidencePercent}%`}</td>
                    <td className="px-3 py-2.5 tabular-nums text-muted-foreground">{j.tokensIn === null ? "·" : `${j.tokensIn} / ${j.tokensOut ?? 0}`}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{when(j.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <p className="px-5 py-4 text-sm text-muted-foreground">No AI assessment jobs yet.</p>}
      </section>
    </div>
  );
}
