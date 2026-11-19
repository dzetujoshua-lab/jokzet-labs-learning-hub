"use client";

import { useState, useTransition } from "react";
import { checkProviderAction } from "@/app/(admin)/admin/ai/actions";
import { verifyLinksAction } from "@/app/(admin)/admin/curriculum/actions";
import { Button } from "@/components/ui/button";
import { CHECK_MEANING } from "@/lib/admin/meanings";
import type { ProviderCheck } from "@/lib/admin/ai-centre";
import type { LinkCheck } from "@/lib/admin/quality";

const when = (d: Date | string) => new Date(d).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Accra" });

/** Makes one real call to the AI provider and says exactly what came back. "Operational" appears only after a call succeeded. */
export function ProviderCheckButton() {
  const [pending, start] = useTransition();
  const [check, setCheck] = useState<ProviderCheck | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      <Button type="button" disabled={pending} onClick={() => start(async () => {
        setError("");
        const r = await checkProviderAction();
        if (!r.ok) return setError(r.error);
        setCheck(r.check);
      })}>{pending ? "Checking…" : "Check the provider now"}</Button>
      <p className="mt-2 text-[11px] text-muted-foreground">Sends one tiny request (about a dozen tokens). Nothing is stored.</p>
      <div role="status" aria-live="polite" className="mt-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {check?.state === "OPERATIONAL" ? <p className="text-[hsl(var(--admin-teal))]">Operational: {check.provider} answered with {check.model} at {when(check.at)}.</p> : null}
        {check?.state === "REFUSED" ? <p className="text-destructive">Not working: {CHECK_MEANING[check.code] ?? "The provider refused the request."}</p> : null}
        {check?.state === "NOT_CONFIGURED" ? <p className="text-muted-foreground">{CHECK_MEANING.NOT_CONFIGURED}</p> : null}
        {check?.state === "LIMITED" ? <p className="text-muted-foreground">Checked a moment ago. Wait a minute before checking again.</p> : null}
      </div>
    </div>
  );
}

/** Opens every approved resource's link once and reports the ones that do not answer. */
export function VerifyLinksButton() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<LinkCheck | null>(null);
  const [error, setError] = useState("");
  return (
    <div>
      <Button type="button" variant="secondary" disabled={pending} onClick={() => start(async () => {
        setError("");
        const r = await verifyLinksAction();
        if (!r.ok) return setError(r.error);
        setResult(r.result);
      })}>{pending ? "Checking links…" : "Verify links now"}</Button>
      <div role="status" aria-live="polite" className="mt-3 text-sm">
        {error ? <p className="text-destructive">{error}</p> : null}
        {result && "limited" in result ? <p className="text-muted-foreground">Links were checked a few minutes ago. Try again in ten minutes.</p> : null}
        {result && !("limited" in result) ? (
          <div>
            <p className={result.failed.length ? "text-[hsl(var(--admin-amber))]" : "text-[hsl(var(--admin-teal))]"}>{result.ok} of {result.checked} links answered{result.failed.length ? `; ${result.failed.length} did not.` : "."}</p>
            {result.failed.length ? <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{result.failed.map((f) => <li key={f.title}>{f.title}: {f.reason}</li>)}</ul> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
