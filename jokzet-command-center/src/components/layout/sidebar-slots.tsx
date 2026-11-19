import Link from "next/link";
import { LogOut, Settings } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth/dal";
import { db } from "@/lib/db";
import { getTotalXp } from "@/lib/missions/service";
import { PROGRAMME_XP_PER_LEVEL } from "@/lib/programme";

/** The account card at the bottom of the sidebar: who is signed in, their real level and XP, and a link to Settings. */
export async function SidebarProgress() {
  const user = await requireUser();
  const [totalXp, profile] = await Promise.all([getTotalXp(user.id), db.profile.findUnique({ where: { userId: user.id }, select: { displayName: true } })]);
  const level = Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL);
  const xpIntoLevel = totalXp % PROGRAMME_XP_PER_LEVEL;
  const name = profile?.displayName?.trim() || "Learner";
  return (
    <>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-secondary font-display text-sm text-foreground">{name.charAt(0).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] text-foreground">{name}</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">Level {level}</p>
        </div>
        <Link href="/settings" aria-label="Settings" className="grid h-8 w-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground">
          <Settings className="h-4 w-4" strokeWidth={1.7} />
        </Link>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-label="Progress to the next level" aria-valuenow={Math.round((xpIntoLevel / PROGRAMME_XP_PER_LEVEL) * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${Math.round((xpIntoLevel / PROGRAMME_XP_PER_LEVEL) * 100)}%` }}
        />
      </div>
      <p className="mt-2 font-mono text-[10px] tabular-nums text-muted-foreground">
        {xpIntoLevel} / {PROGRAMME_XP_PER_LEVEL} XP
      </p>
    </>
  );
}

export function SidebarProgressFallback() {
  return <div className="h-[52px] animate-pulse rounded-xl bg-secondary/60" />;
}

/** `LV n` pill shown in the mobile header (Base44). */
export async function MobileLevel() {
  const user = await requireUser();
  const level = Math.floor((await getTotalXp(user.id)) / PROGRAMME_XP_PER_LEVEL);
  return (
    <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground">
      LV {level}
    </span>
  );
}

/**
 * Sign-out is NOT part of the Base44 design (Base44 handled sessions outside the UI). It is a functional
 * necessity for our own auth, kept in the existing mono-label style. Flagged in VISUAL_FIDELITY_REPORT.md.
 */
export function SignOutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <LogOut className="h-3 w-3" strokeWidth={1.7} /> sign out
      </button>
    </form>
  );
}
