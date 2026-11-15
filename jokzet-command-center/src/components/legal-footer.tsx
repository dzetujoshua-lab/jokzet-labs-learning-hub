import Link from "next/link";
import { LEGAL } from "@/lib/legal";

/** A quiet footer line used on the sign-in screens, the app shell and the policy page itself. */
export function LegalFooter({ className = "", privacyCentre = false }: { className?: string; privacyCentre?: boolean }) {
  return (
    <footer className={`font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground ${className}`}>
      <span>{LEGAL.siteName}</span>
      <span aria-hidden className="mx-2">·</span>
      <Link href="/privacy-policy" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">Privacy Policy</Link>
      {privacyCentre ? (
        <>
          <span aria-hidden className="mx-2">·</span>
          <Link href="/privacy" className="underline-offset-4 transition-colors hover:text-foreground hover:underline">Privacy</Link>
        </>
      ) : null}
    </footer>
  );
}
