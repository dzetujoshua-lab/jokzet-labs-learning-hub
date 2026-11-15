import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { isSameOrigin } from "@/lib/http";
import { clientIp } from "@/lib/ratelimit";

const h = (init: Record<string, string>) => ({ get: (name: string) => init[name.toLowerCase()] ?? null });
const post = (url: string, origin?: string) => new NextRequest(url, { method: "POST", headers: origin ? { origin } : {} });

afterEach(() => {
  delete process.env.APP_URL;
  delete process.env.TRUSTED_PROXY_HOPS;
});

describe("origin check behind a reverse proxy", () => {
  it("keeps the strict default: same origin only, no Origin means refused", () => {
    expect(isSameOrigin(post("http://localhost:3000/api/x", "http://localhost:3000"))).toBe(true);
    expect(isSameOrigin(post("http://localhost:3000/api/x", "https://evil.example"))).toBe(false);
    expect(isSameOrigin(post("http://localhost:3000/api/x"))).toBe(false);
  });

  it("accepts the configured public origin when the proxy shows the server an internal http address", () => {
    process.env.APP_URL = "https://jokzet-labs.iipghstudent.com";
    expect(isSameOrigin(post("http://127.0.0.1:3000/api/x", "https://jokzet-labs.iipghstudent.com"))).toBe(true);
  });

  it("still refuses every other origin when APP_URL is set, including look-alikes and other schemes", () => {
    process.env.APP_URL = "https://jokzet-labs.iipghstudent.com";
    for (const bad of ["https://evil.example", "http://jokzet-labs.iipghstudent.com", "https://jokzet-labs.iipghstudent.com.evil.example", "https://iipghstudent.com", "null"]) {
      expect(isSameOrigin(post("http://127.0.0.1:3000/api/x", bad)), bad).toBe(false);
    }
  });

  it("ignores a malformed APP_URL instead of trusting anything", () => {
    process.env.APP_URL = "not a url";
    expect(isSameOrigin(post("http://127.0.0.1:3000/api/x", "https://evil.example"))).toBe(false);
  });
});

describe("client address behind your own proxy", () => {
  it("keeps today's behaviour when TRUSTED_PROXY_HOPS is unset", () => {
    expect(clientIp(h({ "x-nf-client-connection-ip": "198.51.100.9", "x-forwarded-for": "1.1.1.1" }))).toBe("198.51.100.9");
    expect(clientIp(h({ "x-forwarded-for": "192.0.2.5, 10.0.0.1" }))).toBe("192.0.2.5");
  });

  it("with one trusted proxy, ignores addresses the client added and uses the one the proxy appended", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    // The client claims to be 9.9.9.9; the proxy appended the real address 203.0.113.7.
    expect(clientIp(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("counts hops from the right when two proxies are trusted", () => {
    process.env.TRUSTED_PROXY_HOPS = "2";
    expect(clientIp(h({ "x-forwarded-for": "9.9.9.9, 203.0.113.7, 10.0.0.2" }))).toBe("203.0.113.7");
  });

  it("falls back safely when the chain is shorter than the trusted hops or the setting is invalid", () => {
    process.env.TRUSTED_PROXY_HOPS = "3";
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7", "x-real-ip": "198.51.100.1" }))).toBe("198.51.100.1");
    process.env.TRUSTED_PROXY_HOPS = "banana";
    expect(clientIp(h({ "x-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
    process.env.TRUSTED_PROXY_HOPS = "-1";
    expect(clientIp(h({}))).toBe("unknown");
  });

  it("never lets the Netlify edge header be overridden", () => {
    process.env.TRUSTED_PROXY_HOPS = "1";
    expect(clientIp(h({ "x-nf-client-connection-ip": "198.51.100.9", "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("198.51.100.9");
  });
});
