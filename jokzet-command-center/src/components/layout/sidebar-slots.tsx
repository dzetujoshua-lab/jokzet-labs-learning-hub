import { LogOut } from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { requireUser } from "@/lib/auth/dal";
import { getTotalXp } from "@/lib/missions/service";
import { PROGRAMME_XP_PER_LEVEL } from "@/lib/programme";

/** Level + XP footer, same markup as the Base44 sidebar. Async: render inside <Suspense>. */
export async function SidebarProgress() {
  const user = await requireUser();
  const totalXp = await getTotalXp(user.id);
  const level = Math.floor(totalXp / PROGRAMME_XP_PER_LEVEL);
  const xpIntoLevel = totalXp % PROGRAMME_XP_PER_LEVEL;
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="mono-label">Level</p>
        <p className="font-display text-sm tabular-nums text-foreground">{level}</p>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-secondary">
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
