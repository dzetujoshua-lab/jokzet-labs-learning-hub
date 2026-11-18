import { readFileSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { LegalFooter } from "@/components/legal-footer";
import { proxy } from "@/proxy";

const root = path.resolve(import.meta.dirname, "..");
const src = (p: string) => readFileSync(path.join(root, p), "utf8");
describe("the Privacy page is reachable and private", () => {
  it("needs a sign-in", () => {
    const r = proxy(new NextRequest("http://localhost/privacy"));
    expect(r.status).toBe(307);
    expect(r.headers.get("location")).toMatch(/\/login$/);
  });

  it("is linked from the app footer only (the sign-in screens have no Privacy page to link)", () => {
    expect(renderToStaticMarkup(createElement(LegalFooter, { privacyCentre: true }))).toContain('href="/privacy"');
    expect(renderToStaticMarkup(createElement(LegalFooter))).not.toContain('href="/privacy"');
    expect(src("src/components/layout/app-shell.tsx")).toContain("<LegalFooter privacyCentre");
  });

  it("holds the three panels, and Settings points there instead of duplicating them", () => {
    const page = src("src/app/(account)/privacy/page.tsx");
    for (const needle of ['aria-labelledby="your-data"', 'aria-labelledby="policy-contact"', 'aria-labelledby="delete-account"', "/api/account/export", "<DeleteAccountForm />"]) {
      expect(page, needle).toContain(needle);
    }
    const settings = src("src/app/(account)/settings/page.tsx");
    expect(settings).toContain('href="/privacy"');
    expect(settings).not.toContain("DeleteAccountForm");
    expect(settings).not.toContain("/api/account/export");
  });
});
