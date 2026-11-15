import type { Metadata } from "next";
import Link from "next/link";
import { DeleteAccountForm } from "@/components/settings/delete-account-form";
import { PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/dal";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy" };

export default async function PrivacyPage() {
  await requireUser();
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Privacy"
        title="Your privacy"
        description="See what the platform holds about you, take a copy, or delete it. Everything here applies only to your own account."
      />

      <section className="panel p-5 md:p-6" aria-labelledby="your-data">
        <p className="mono-label">Your data</p>
        <h2 id="your-data" className="mt-2 font-display text-lg font-medium text-foreground">Download a copy of your data</h2>
        <p className="mt-2 max-w-prose text-[13px] text-muted-foreground">
          Get everything this platform holds about you as one JSON file: your profile, missions, submissions, assessments, plans, reminders and more. It leaves out your password, sign-in tokens and the contents of uploaded files. You can download it up to five times an hour.
        </p>
        <a href="/api/account/export" download className="mt-4 inline-flex h-9 items-center rounded-md border border-border px-4 text-[13px] font-medium text-foreground transition-colors hover:bg-muted">
          Download my data (JSON)
        </a>
      </section>

      <section className="panel p-5 md:p-6" aria-labelledby="policy-contact">
        <p className="mono-label">Policy and contact</p>
        <h2 id="policy-contact" className="mt-2 font-display text-lg font-medium text-foreground">How your information is handled</h2>
        <p className="mt-2 max-w-prose text-[13px] text-muted-foreground">
          Read the Privacy Policy, or email the privacy address if you cannot sign in or want a request handled by a person.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <Link href="/privacy-policy" className="text-primary underline-offset-4 hover:underline">Privacy Policy</Link>
          {LEGAL.privacyContactEmail ? (
            <a href={`mailto:${LEGAL.privacyContactEmail}`} className="text-primary underline-offset-4 hover:underline">Email the privacy contact</a>
          ) : null}
        </p>
      </section>

      <section className="panel border-destructive/40 p-5 md:p-6" aria-labelledby="delete-account">
        <p className="mono-label">Danger zone</p>
        <h2 id="delete-account" className="mt-2 font-display text-lg font-medium text-foreground">Delete my account</h2>
        <p className="mt-2 max-w-prose text-[13px] text-muted-foreground">
          This permanently deletes your account and everything linked to it: your profile, missions, submissions, assessments, plans, reminders, portfolio, evidence and uploaded files. It cannot be undone. Download a copy of your data first if you want to keep it.
        </p>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
