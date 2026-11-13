import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import PrivacyPolicyPage from "@/app/privacy-policy/page";
import { LegalFooter } from "@/components/legal-footer";
import { SESSION_TTL_MS } from "@/lib/auth/sessions";
import { LEGAL } from "@/lib/legal";
import { proxy } from "@/proxy";

const html = renderToStaticMarkup(createElement(PrivacyPolicyPage));
const text = html.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/g, " ").replace(/\s+/g, " ");
const root = path.resolve(import.meta.dirname, "..");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    if (f === "generated" || f === "node_modules") return [];
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(f) ? [p] : [];
  });
}

describe("the policy is public", () => {
  const call = (p: string, cookie?: string) => proxy(new NextRequest(`http://localhost${p}`, cookie ? { headers: { cookie } } : undefined));

  it("needs no sign-in, while private pages still do", () => {
    for (const p of ["/privacy-policy", "/login", "/register"]) {
      const r = call(p);
      expect(r.headers.get("location"), p).toBeNull(); // not redirected
    }
    for (const p of ["/", "/missions", "/timetable", "/privacy-policy-private", "/privacy-policy/extra"]) {
      const r = call(p);
      expect(r.status, p).toBe(307);
      expect(r.headers.get("location")).toMatch(/\/login$/);
    }
  });

  it("is also reachable when signed in", () => {
    expect(call("/privacy-policy", "jz_session=abc").headers.get("location")).toBeNull();
  });
});

describe("the page covers everything required", () => {
  const REQUIRED = [
    "Introduction", "Information we collect", "Google account information", "Gmail API access and permissions", "How we use collected information",
    "How we store and protect information", "Data sharing and disclosure", "Google API Services User Data Policy and Limited Use", "Data retention and deletion",
    "Revoking Google account access", "Your rights", "Contact information",
  ];
  it("has every section as a heading, with a working table-of-contents link to each", () => {
    for (const title of REQUIRED) expect(text, title).toContain(title);
    const ids = [...html.matchAll(/<section id="([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids.length).toBeGreaterThanOrEqual(12);
    for (const id of ids) expect(html, id).toContain(`href="#${id}"`);
    expect([...html.matchAll(/<h1[ >]/g)]).toHaveLength(1); // one page title
    expect(html).toContain("Last updated 13 November 2026");
  });

  it("links to the Google policy and permissions pages safely", () => {
    for (const url of ["https://developers.google.com/terms/api-services-user-data-policy", "https://myaccount.google.com/permissions"]) {
      expect(html).toMatch(new RegExp(`href="${url.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"[^>]*rel="noopener noreferrer"`));
    }
  });

  it("is linked from the footer to /privacy-policy", () => {
    const footer = renderToStaticMarkup(createElement(LegalFooter));
    expect(footer).toContain('href="/privacy-policy"');
    expect(footer).toContain("Privacy Policy");
    expect(html).toContain('href="/privacy-policy"'); // the policy page carries the footer too
  });
});

describe("the page never invents facts", () => {
  it("shows no contact details that were not provided, and says so plainly", () => {
    expect(LEGAL.privacyContactEmail).toBeNull();
    expect(html).not.toContain("mailto:");
    expect(text).not.toMatch(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/); // no email address anywhere
    expect(text).toContain("A privacy contact address has not been published yet.");
    expect(text).not.toMatch(/undefined|null|\[|TODO|lorem/i);
  });

  it("makes no claims the app does not support", () => {
    for (const claim of [/GDPR/, /CCPA/, /COPPA/, /encrypted at rest/i, /we (are|will be) (SOC|ISO)/i, /guarantee/i, /gmail\.(readonly|send|modify|compose)/i, /ads?-?free/i]) {
      expect(text, String(claim)).not.toMatch(claim);
    }
    expect(text).toContain("does not use the Gmail API");
    expect(text).toContain("does not offer");
    expect(text).toContain("do not sell");
  });
});

describe("the page stays true to the code", () => {
  it("states the session facts the code actually implements", () => {
    expect(SESSION_TTL_MS).toBe(14 * 24 * 60 * 60 * 1000);
    expect(text).toContain("14 days");
    expect(readFileSync(path.join(root, "src/lib/auth/cookie.ts"), "utf8")).toContain("__Host-jz_session");
    expect(text).toContain("__Host-jz_session");
    expect(readFileSync(path.join(root, "src/lib/auth/password.ts"), "utf8")).toContain("@node-rs/argon2");
    expect(text).toContain("Argon2");
  });

  it("fails if the app gains Google sign-in or Gmail access, so the policy is updated first", () => {
    const skip = (f: string) => f.includes(`${path.sep}privacy-policy${path.sep}`) || f.endsWith(`${path.sep}legal.ts`) || f.includes(`${path.sep}neon-auth`);
    const offenders = files(path.join(root, "src")).filter((f) => !skip(f)).filter((f) => /gmail|accounts\.google\.com|googleapis\.com\/(gmail|oauth)|signIn\.social|google-auth|@googleapis|next-auth/i.test(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(root, f))).toEqual([]);
    const deps = Object.keys({ ...JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).dependencies });
    expect(deps.filter((d) => /google|gmail|passport|next-auth|auth0/i.test(d))).toEqual([]);
  });

  it("has no analytics or advertising trackers, as the page says", () => {
    const offenders = files(path.join(root, "src")).filter((f) => !f.includes("privacy-policy")).filter((f) => /googletagmanager|gtag\(|plausible\.io|posthog|mixpanel|hotjar|fbq\(|connect\.facebook\.net/i.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });
});
