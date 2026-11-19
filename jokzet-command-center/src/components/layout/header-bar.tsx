import Link from "next/link";
import { Bell, Search, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getTotalXp } from "@/lib/missions/service";
import { PROGRAMME_XP_PER_LEVEL } from "@/lib/programme";

/** A plain GET form (works without JavaScript): the results page searches only content the learner is allowed to see. */
export function SearchBox({ className = "" }: { className?: string }) {
  return (
    <form action="/search" method="get" role="search" className={className}>
      <label htmlFor="site-search" className="sr-only">Search lessons, courses and assessments</label>
      <div className="flex h-10 items-center gap-2 rounded-full border border-border bg-card/70 px-4 transition-colors focus-within:border-primary/60">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.7} aria-hidden="true" />
        <input id="site-search" name="q" type="search" maxLength={80} autoComplete="off" placeholder="Search lessons, courses…" className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
      </div>
    </form>
  );
}

/** Notifications bell (a dot only when something is unread) and the learner's real XP and level. Async: render inside <Suspense>. */
export async function HeaderStatus() {
  const user = await requireUser();
  const [xp, unread] = await Promise.all([getTotalXp(user.id), db.notification.count({ where: { userId: user.id, readAt: null } })]);
  const level = Math.floor(xp / PROGRAMME_XP_PER_LEVEL);
  return (
    <div className="flex items-center gap-2.5">
      <span className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card/70 px-3.5 font-mono text-[11px] tabular-nums text-foreground" title="Official XP, added when a reviewer confirms your work">
        <Zap className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} aria-hidden="true" />
        {xp} XP <span className="hidden text-muted-foreground sm:inline">· LV {level}</span>
      </span>
      <Link href="/reminders" className="relative grid h-10 w-10 place-items-center rounded-full border border-border bg-card/70 text-muted-foreground transition-colors hover:text-foreground" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}>
        <Bell className="h-4 w-4" strokeWidth={1.7} aria-hidden="true" />
        {unread ? <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" /> : null}
      </Link>
    </div>
  );
}

export function HeaderStatusFallback() {
  return <div className="h-10 w-40 animate-pulse rounded-full bg-secondary/60" />;
}
