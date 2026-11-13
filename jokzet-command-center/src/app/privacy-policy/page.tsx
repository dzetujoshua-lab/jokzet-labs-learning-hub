import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { LegalFooter } from "@/components/legal-footer";
import { GOOGLE_PERMISSIONS_URL, GOOGLE_USER_DATA_POLICY_URL, LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${LEGAL.productName} handles your information: what is collected, why, who can see it, how long it is kept, and how to ask for changes or deletion.`,
};

const SECTIONS = [
  ["introduction", "Introduction"],
  ["information-we-collect", "Information we collect"],
  ["google-account-information", "Google account information"],
  ["gmail-api-access", "Gmail API access and permissions"],
  ["how-we-use-information", "How we use collected information"],
  ["storage-and-security", "How we store and protect information"],
  ["sharing-and-disclosure", "Data sharing and disclosure"],
  ["google-api-user-data-policy", "Google API Services User Data Policy and Limited Use"],
  ["retention-and-deletion", "Data retention and deletion"],
  ["revoking-google-access", "Revoking Google account access"],
  ["your-rights", "Your rights"],
  ["contact", "Contact information"],
  ["changes", "Changes to this policy"],
] as const;

const longDate = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

function Section({ id, n, title, children }: { id: string; n: number; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="panel scroll-mt-6 space-y-3 p-6 sm:p-7">
      <p className="mono-label">Section {n}</p>
      <h2 id={`${id}-h`} className="font-display text-xl font-medium leading-snug text-foreground">{title}</h2>
      <div className="space-y-3 text-[14px] leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
const H = ({ children }: { children: React.ReactNode }) => <h3 className="pt-1 text-[13px] font-medium text-foreground">{children}</h3>;
const List = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="list-disc space-y-1.5 pl-5 marker:text-primary/60">
    {items.map((x, i) => <li key={i}>{x}</li>)}
  </ul>
);
const Ext = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">{children}</a>
);

/** Public page: no sign-in, no cookies, no database. Prerendered, so it loads the same everywhere (including Netlify). */
export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <Link href="/" className="flex items-center gap-3" aria-label={`${LEGAL.siteName} home`}>
            <BrandLogo className="h-9 w-9" />
            <span>
              <span className="block font-mono text-[10px] uppercase tracking-[0.28em] text-primary">Jokzet Labs</span>
              <span className="mt-1 block font-display text-[14px] font-medium leading-tight text-foreground">Learning Command Center</span>
            </span>
          </Link>
          <Link href="/login" className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground">Sign in</Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6 sm:py-14">
        <div className="animate-rise">
          <p className="mono-label">Legal</p>
          <h1 className="mt-3 font-display text-[30px] font-medium leading-tight tracking-tight text-foreground sm:text-[38px]">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">Last updated {longDate(LEGAL.lastUpdated)}</p>
        </div>

        <section className="panel space-y-3 p-6 sm:p-7" aria-labelledby="short-h">
          <p className="mono-label">In short</p>
          <h2 id="short-h" className="sr-only">Summary</h2>
          <List
            items={[
              "You sign up with an email address and a password. There is no Google sign-in, and the platform does not connect to your Google account or to Gmail.",
              "We keep what you put into the platform: your account, your learning progress, the work and evidence you submit, and your reminder settings.",
              "There are no advertising or analytics trackers. The only cookie is the one that keeps you signed in.",
              "If you ask for your work to be reviewed, the person reviewing it can see that submission and its evidence. Each time they open a file it is logged.",
              "We do not sell your information.",
            ]}
          />
        </section>

        <nav aria-label="Contents" className="panel p-6 sm:p-7">
          <p className="mono-label">Contents</p>
          <ol className="mt-3 grid gap-x-8 gap-y-1.5 text-[13px] sm:grid-cols-2">
            {SECTIONS.map(([id, title], i) => (
              <li key={id}>
                <a href={`#${id}`} className="text-muted-foreground transition-colors hover:text-primary">
                  <span className="mr-2 font-mono text-[10px] tabular-nums text-primary/70">{String(i + 1).padStart(2, "0")}</span>
                  {title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <Section id="introduction" n={1} title="Introduction">
          <p>
            {LEGAL.productName} (the &ldquo;platform&rdquo;) is a personal learning programme at{" "}
            <Ext href={LEGAL.siteUrl}>{LEGAL.siteUrl.replace("https://", "")}</Ext>. It is run by {LEGAL.siteName}
            {LEGAL.operatorLegalName ? <> ({LEGAL.operatorLegalName})</> : null} from {LEGAL.country}, {LEGAL.businessStatus}. This policy explains what information the platform handles, why, who can see it, how long it is kept, and how you can ask for it to be changed or deleted.
          </p>
          <p>The platform is for people aged 18 or over, and sign-up asks you to confirm this. Accounts created before that question was added were not asked. We do not knowingly provide the platform to anyone under 18; if you believe a child has signed up, contact us and we will delete the account.</p>
          <p>It describes what the platform actually does today. If that changes, this page will be updated.</p>
        </Section>

        <Section id="information-we-collect" n={2} title="Information we collect">
          <H>Account</H>
          <List items={["Your email address and the display name you choose.", "Your password, which is stored only as a one-way Argon2 hash. We cannot read it back.", "Whether you confirmed at sign-up that you are 18 or older, and when. This is your own confirmation; we do not check your age or ask for your date of birth."]} />
          <H>Signing in</H>
          <List
            items={[
              "A random session token. Your browser keeps the token in a cookie; we store only a hash of it.",
              "For each signed-in session we also store the browser's user-agent text and the IP address it connected from, together with when the session was created and last used.",
              "Short-lived counters that limit repeated sign-in attempts. They are keyed by hashed values of the address and email involved.",
            ]}
          />
          <H>Learning and progress</H>
          <List items={["The missions you start and complete, the steps you tick off, your own notes, the time you record, and the XP, levels, skills and achievements that result.", "A record of learning activity (for example a mission started or an assessment passed), with minutes where recorded."]} />
          <H>Work and evidence you submit</H>
          <List items={["Written explanations, repository and live-project links, and evidence entries.", "Files you upload as evidence (such as screenshots, photos, video, documents and code).", "Your self-assessment scores, feedback and corrections, and any reviewer decision on your work."]} />
          <H>Portfolio and capstone</H>
          <p>Portfolio projects and links, and the business records you enter in the capstone project (such as customers, suppliers, products, sales and expenses). You decide what to enter there. Those records can include other people&rsquo;s names or contact details if you choose to add them, so please enter only what you are entitled to.</p>
          <H>Reminders and notifications</H>
          <List items={["Reminders you create, any schedule you import, your reminder settings (including your time zone) and your notification history.", "If you turn on browser or push notifications: the subscription details your browser gives us (a push address and encryption keys). They are used only to deliver your notifications."]} />
          <H>Personalised programme (if you use it)</H>
          <List items={["Your answers when setting up: experience level, the subjects you chose and any notes, your study days, start time, session and break lengths, time zone, how long you want the programme to run, and your rescheduling choices.", "Any baseline result, your study plan and timetable, and a history of changes to it (for example sessions you moved).", "When you request a review: the request, the reviewer&rsquo;s decision and comments, and a log of each time a reviewer opens a file of yours."]} />
          <H>Cookies and similar technology</H>
          <p>
            One essential cookie keeps you signed in (named <code className="rounded bg-secondary px-1 py-0.5 font-mono text-[12px] text-foreground">__Host-jz_session</code>). It is HTTP-only, marked secure, limited to this site, and expires after 14 days without use. While you are signed in, your browser also registers a service worker (so notifications can be shown), and the open page checks with our server about every 30 seconds for reminders that are due. We do not use advertising cookies or analytics trackers.
          </p>
          <H>What we do not collect</H>
          <p>The platform has no payments, so it does not collect card or bank details. It does not ask for your precise location, your contacts, or any Google account data.</p>
        </Section>

        <Section id="google-account-information" n={3} title="Google account information">
          <p>The platform does not offer &ldquo;Sign in with Google&rdquo; and does not connect to your Google account. We do not request, receive or store any information from your Google account, such as your Google profile, name, email address, contacts, calendar or files.</p>
          <p>Your account here is created with an email address and password you enter on our sign-up page. That email address can be a Gmail address, but it is just text you typed; it does not give us any access to the mailbox.</p>
        </Section>

        <Section id="gmail-api-access" n={4} title="Gmail API access and permissions">
          <p>The platform does not use the Gmail API. It requests no Gmail permissions (scopes). It does not read, send, draft, modify, label or delete email, and it does not access the contents or metadata of any mailbox.</p>
          <p>If a Gmail feature is ever added, this section will be updated to describe it before any access is requested, and you would be asked for your consent through Google&rsquo;s own permission screen.</p>
        </Section>

        <Section id="how-we-use-information" n={5} title="How we use collected information">
          <List
            items={[
              "To create your account, keep you signed in and run the learning programme you use.",
              "To save your progress, assess your work, give feedback and show your own progress, portfolio and reports.",
              "To send the reminders and notifications you set up or turn on.",
              "To build and adjust your study plan and timetable from the choices you made, using fixed rules in the software.",
              "To let a reviewer verify your work when you request it, and to keep a record of that review.",
              "To keep the service secure and stable (for example, limiting repeated sign-in attempts and detecting misuse).",
            ]}
          />
          <p>We do not use your information for advertising, we do not sell it, and we do not use your work to train AI models or send it to AI services. No automated decision about you is made without a person involved where credit is concerned: a self-assessment is recorded as yours, and only a reviewer can verify it.</p>
        </Section>

        <Section id="storage-and-security" n={6} title="How we store and protect information">
          <List
            items={[
              "The platform runs on Netlify. Account and learning data is stored in a Neon PostgreSQL database hosted in Frankfurt, Germany (AWS eu-central-1). Files you upload are stored in Netlify Blobs.",
              "Passwords are hashed (Argon2). Session tokens are stored only as hashes. The session cookie is HTTP-only, secure and restricted to this site, and the site is served over HTTPS.",
              "Your files are only served to you through checks that confirm they are yours. A reviewer can open a file only while they hold your open review request, and every such access is logged.",
              "Repeated sign-in attempts are rate-limited, and the platform refuses to save evidence text that looks like a password or key, because credentials should never be stored as evidence.",
            ]}
          />
          <p>No online service can promise perfect security, but we design the platform to keep your information private and limit who can see it.</p>
        </Section>

        <Section id="sharing-and-disclosure" n={7} title="Data sharing and disclosure">
          <p>We do not sell or rent your information, and we do not share it with advertisers. It is handled by:</p>
          <List
            items={[
              <><strong className="font-medium text-foreground">Service providers that run the platform:</strong> Netlify (hosting, serverless functions, file storage) and Neon (database). They process data only to provide those services.</>,
              <><strong className="font-medium text-foreground">People with a reviewer or administrator role:</strong> a reviewer can see a submission and its evidence only for a review you requested and that they have claimed. Administrators can see the information needed to run the platform.</>,
              <><strong className="font-medium text-foreground">Video providers, only if you play a video:</strong> some missions may show an embedded video using YouTube&rsquo;s privacy-enhanced domain. If you play it, that provider receives your browser&rsquo;s request, as with any embedded video.</>,
              <><strong className="font-medium text-foreground">Browser push services, only if you turn on push notifications:</strong> your browser vendor&rsquo;s service (for example one operated by Google, Mozilla, Microsoft or Apple) carries the notification to your device. It receives the notification text and the address your browser provided.</>,
            ]}
          />
          <p>Other learners cannot see your information.</p>
        </Section>

        <Section id="google-api-user-data-policy" n={8} title="Google API Services User Data Policy and Limited Use">
          <p>The platform does not obtain data from Google APIs, so there is currently no Google user data to which the Limited Use requirements would apply.</p>
          <p>
            If we ever access Google user data, our use and transfer of information received from Google APIs will adhere to the{" "}
            <Ext href={GOOGLE_USER_DATA_POLICY_URL}>Google API Services User Data Policy</Ext>, including its Limited Use requirements, and this policy will be updated first.
          </p>
        </Section>

        <Section id="retention-and-deletion" n={9} title="Data retention and deletion">
          <List
            items={[
              "Sign-in sessions expire after 14 days without use (and are renewed while you keep using the platform). Signing out ends the session straight away.",
              "Your account information, progress, submissions, assessments and portfolio are kept for as long as your account exists.",
              "You can delete evidence that is not attached to a submitted mission, and the uploaded file is removed from storage with it. Work you have submitted and its assessment are kept as part of your learning record.",
              "You can delete your account yourself in Settings (you confirm with your password). This permanently removes your account and the data linked to it, including uploaded files, and signs you out everywhere. It cannot be undone, so download a copy of your data first if you want one.",
              "If you review other learners&rsquo; work, the verdicts you gave stay with those learners but no longer carry your name. A role-change audit entry keeps its history without your email address.",
              "After deletion, copies can remain for a short time in the database provider&rsquo;s backup history before they expire.",
            ]}
          />
          <p>You can download a copy of your data and delete your account from Settings. If you cannot sign in, contact us and we will help.</p>
        </Section>

        <Section id="revoking-google-access" n={10} title="Revoking Google account access">
          <p>
            Because the platform never asks for access to your Google account, there is nothing here to revoke. If you want to check which apps can access your Google account, you can review and remove them at{" "}
            <Ext href={GOOGLE_PERMISSIONS_URL}>myaccount.google.com/permissions</Ext>. If you ever see a Google permission request that claims to come from this platform, please tell us.
          </p>
          <p>To stop notifications from this site, turn them off in the platform&rsquo;s settings or in your browser&rsquo;s site settings.</p>
        </Section>

        <Section id="your-rights" n={11} title="Your rights">
          <p>In the platform you can:</p>
          <List items={["see all of your own information, change your profile and settings, and download a copy of your data from Settings, and delete your whole account;", "delete evidence that is not part of a submitted mission;", "turn notifications on or off and manage your reminders;", "sign out at any time."]} />
          <p>You can also contact us to correct your information, to delete your account, or to raise a concern about how it is handled. Depending on where you live, you may have further rights under data-protection law, including the right to complain to your local data-protection authority. In Ghana that is the{" "}
            <Ext href={LEGAL.authorityUrl}>{LEGAL.authorityName}</Ext>.</p>
        </Section>

        <Section id="contact" n={12} title="Contact information">
          <p>For privacy questions and requests (access, correction, deletion, or concerns):</p>
          <dl className="grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[9rem_1fr]">
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Operator</dt>
            <dd className="text-foreground">{LEGAL.siteName}{LEGAL.operatorLegalName ? ` (${LEGAL.operatorLegalName})` : ""}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Country</dt>
            <dd className="text-foreground">{LEGAL.country}</dd>
            <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Email</dt>
            <dd className="text-foreground">
              {LEGAL.privacyContactEmail ? <a className="text-primary underline-offset-4 hover:underline" href={`mailto:${LEGAL.privacyContactEmail}`}>{LEGAL.privacyContactEmail}</a> : "A privacy contact address has not been published yet."}
            </dd>
            {LEGAL.postalAddress ? (
              <>
                <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Address</dt>
                <dd className="text-foreground">{LEGAL.postalAddress}</dd>
              </>
            ) : null}
          </dl>
        </Section>

        <Section id="changes" n={13} title="Changes to this policy">
          <p>When the platform&rsquo;s handling of information changes, this page will be updated and the &ldquo;last updated&rdquo; date at the top will change.</p>
        </Section>
      </main>

      <div className="border-t border-border px-4 py-6 text-center">
        <LegalFooter />
      </div>
    </div>
  );
}
