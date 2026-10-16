// One server for website + API (single Render service): /api and /health are the API, static
// files come from the website's public folder, everything else goes to the website handler.
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("../src/db/client", () => ({ db: () => async () => [] }));
const { createApp } = await import("../src/app");

let server: Server;
let base = "";
const seen: { url: string; body: string }[] = [];

/** stands in for the nitro website: echoes what it received */
function fakeWebsite(req: IncomingMessage, res: ServerResponse) {
  let body = "";
  req.on("data", (c: Buffer) => (body += c.toString("utf8")));
  req.on("end", () => {
    seen.push({ url: req.url ?? "", body });
    res.setHeader("content-type", "text/html");
    res.end(`<html>website:${req.url}</html>`);
  });
}

beforeAll(async () => {
  const pub = mkdtempSync(join(tmpdir(), "udgam-public-"));
  mkdirSync(join(pub, "assets"));
  mkdirSync(join(pub, "rulebooks"));
  writeFileSync(join(pub, "assets", "app-abc123.js"), "console.log(1)");
  writeFileSync(join(pub, "rulebooks", "bgmi.pdf"), "%PDF-1.7 test");
  writeFileSync(join(pub, "robots.txt"), "User-agent: *");
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  server = createApp({ website: fakeWebsite, websitePublicDir: pub }).listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
});

describe("website + API on one server", () => {
  it("routes pages to the website and keeps the API on /api and /health", async () => {
    const page = await fetch(`${base}/events`);
    expect(page.status).toBe(200);
    expect(await page.text()).toBe("<html>website:/events</html>");
    expect((await (await fetch(`${base}/health`)).json()).ok).toBe(true);
    const api404 = await fetch(`${base}/api/does-not-exist`);
    expect(api404.status).toBe(404);
    expect(api404.headers.get("content-type")).toMatch(/json/);
  });

  it("serves built assets with long caching and other public files normally", async () => {
    const js = await fetch(`${base}/assets/app-abc123.js`);
    expect(js.status).toBe(200);
    expect(js.headers.get("cache-control")).toMatch(/immutable/);
    expect((await fetch(`${base}/rulebooks/bgmi.pdf`)).headers.get("content-type")).toBe(
      "application/pdf",
    );
    expect(await (await fetch(`${base}/robots.txt`)).text()).toBe("User-agent: *");
    // a missing hashed asset is a clean 404, never the website's HTML
    const missing = await fetch(`${base}/assets/nope.js`);
    expect(missing.status).toBe(404);
    expect(await missing.text()).not.toContain("website:");
  });

  it("passes request bodies to the website untouched (its server functions read them)", async () => {
    const payload = JSON.stringify({ t: { k: ["data"] }, f: 63 });
    await fetch(`${base}/_serverFn/abc`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });
    expect(seen.at(-1)).toEqual({ url: "/_serverFn/abc", body: payload });
  });

  it("uses strict security headers for the API but not ones that would break the site", async () => {
    const api = await fetch(`${base}/health`);
    expect(api.headers.get("content-security-policy")).toBeTruthy();
    const page = await fetch(`${base}/`);
    expect(page.headers.get("content-security-policy")).toBeNull();
    expect(page.headers.get("x-content-type-options")).toBe("nosniff");
    expect(page.headers.get("cross-origin-opener-policy")).toBe("same-origin-allow-popups");
  });
});
