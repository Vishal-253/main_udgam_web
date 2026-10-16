// HTTP-level tests: the real Express app on a random port, a real Postgres (PGlite) loaded with
// db/schema.sql. Only Razorpay's network calls and Firebase are mocked.
import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

let pg: PGlite;
const run = (text: string, params: unknown[] = []) => pg.query(text, params).then((r) => r.rows);
const sqlTag = Object.assign(
  (strings: TemplateStringsArray, ...values: unknown[]) =>
    run(
      strings.reduce((acc, s, i) => `${acc}$${i}${s}`),
      values,
    ),
  { query: (text: string, params: unknown[] = []) => run(text, params) },
);
vi.mock("../src/db/client", () => ({ db: () => sqlTag }));

let orderSeq = 0;
let capturedAmount: number | null = null;
vi.mock("../src/services/razorpay", async (orig) => ({
  ...(await orig<typeof import("../src/services/razorpay")>()),
  createOrder: vi.fn(async ({ amountPaise }: { amountPaise: number }) => ({
    id: `order_HTTP${++orderSeq}x`,
    amount: amountPaise,
    currency: "INR",
    status: "created",
  })),
  ensureCaptured: vi.fn(async () => capturedAmount),
  publicKeyId: () => "rzp_test_key",
}));
vi.mock("../src/services/firestore", () => ({ firestoreConfig: () => null, upsertVersioned: vi.fn() }));

const { createApp } = await import("../src/app");

const ORIGIN = "https://udgam.example.com";
let server: Server;
let base = "";

async function start(): Promise<{ server: Server; base: string }> {
  const s = createApp().listen(0);
  await new Promise((r) => s.once("listening", r));
  return { server: s, base: `http://127.0.0.1:${(s.address() as AddressInfo).port}` };
}

const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  fetch(`${base}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

const leader = (roll: string) => ({
  name: "Asha Rai",
  rollNo: roll,
  email: `${roll.toLowerCase()}@example.com`,
  phone: "9876543210",
  year: "2nd Year",
  department: "CSE",
  college: "NIT Sikkim",
});

beforeAll(async () => {
  pg = new PGlite();
  await pg.exec(readFileSync(resolve(__dirname, "../db/schema.sql"), "utf8"));
  Object.assign(process.env, {
    REGISTRATIONS_OPEN: "true",
    FRONTEND_ORIGINS: `${ORIGIN},http://localhost:8080`,
    RAZORPAY_KEY_SECRET: "test_secret",
    RAZORPAY_WEBHOOK_SECRET: "hook_secret",
    ADMIN_USERNAME: "admin-user",
    ADMIN_PASSWORD: "correct horse battery",
    ADMIN_SESSION_SECRET: "y".repeat(40),
    BACKUP_SYNC_TOKEN: "s".repeat(30),
  });
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
  ({ server, base } = await start());
});

afterAll(() => {
  server.close();
});

describe("basics", () => {
  it("health check answers without touching the database", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true });
  });

  it("sets security headers and hides the framework", async () => {
    const res = await fetch(`${base}/health`);
    expect(res.headers.get("x-powered-by")).toBeNull();
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("allows the website origin and not others (CORS)", async () => {
    const ok = await fetch(`${base}/api/registrations`, {
      method: "OPTIONS",
      headers: { origin: ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
    });
    expect(ok.headers.get("access-control-allow-origin")).toBe(ORIGIN);
    const evil = await fetch(`${base}/api/registrations`, {
      method: "OPTIONS",
      headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
    });
    expect(evil.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("answers malformed JSON and oversized bodies with a generic 4xx", async () => {
    const bad = await post("/api/registrations", "{not json");
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({ ok: false, code: "invalid", message: "Invalid request." });
    const big = await post("/api/registrations", { pad: "x".repeat(40_000) });
    expect(big.status).toBe(413);
  });

  it("returns 404 JSON for unknown routes", async () => {
    expect((await fetch(`${base}/api/nope`)).status).toBe(404);
  });
});

describe("registration over HTTP", () => {
  it("free event confirms; duplicate student is refused", async () => {
    const body = { eventId: "photography", leader: leader("B23HT001"), members: [] };
    const first = await (await post("/api/registrations", body)).json();
    expect(first).toMatchObject({ ok: true, status: "confirmed" });
    const again = await (await post("/api/registrations", body)).json();
    expect(again).toMatchObject({ ok: false, code: "conflict" });
    const status = await (await fetch(`${base}/api/registrations/${first.registrationId}/status`)).json();
    expect(status).toEqual({ status: "confirmed", eventId: "photography" });
  });

  it("paid event: checkout signature verified server-side; forged signature refused", async () => {
    const members = ["B", "C", "D"].map((x, i) => ({ name: `Member ${x}`, rollNo: `B23HR0${i}` }));
    const start = await (
      await post("/api/registrations", { eventId: "rangoli", teamName: "Hues", leader: leader("B23HR09"), members })
    ).json();
    expect(start).toMatchObject({ status: "payment_required", order: { amount: 8000, keyId: "rzp_test_key" } });

    const orderId: string = start.order.id;
    const paymentId = "pay_HTTP1abc";
    const forged = await (
      await post("/api/registrations/verify-payment", { orderId, paymentId, signature: "a".repeat(64) })
    ).json();
    expect(forged).toMatchObject({ ok: false, code: "invalid" });

    capturedAmount = 8000;
    const signature = createHmac("sha256", "test_secret").update(`${orderId}|${paymentId}`).digest("hex");
    const ok = await (await post("/api/registrations/verify-payment", { orderId, paymentId, signature })).json();
    expect(ok).toMatchObject({ ok: true, status: "confirmed" });
  });

  it("serves a receipt with members, payment and masked contact details", async () => {
    const list = await run("select id from registrations where team_name = 'Hues'");
    const id = (list[0] as { id: string }).id;
    const res = await fetch(`${base}/api/registrations/${id}/receipt`);
    expect(res.status).toBe(200);
    const r = await res.json();
    expect(r).toMatchObject({
      registrationId: id,
      eventName: "Rangoli",
      teamName: "Hues",
      status: "confirmed",
      amountPaise: 8000,
      paymentId: "pay_HTTP1abc",
      leaderPhone: "******3210",
    });
    expect(r.leaderEmail).toBe("b2*****@example.com");
    expect(r.members).toHaveLength(4);
    expect(r.members[0]).toEqual({ name: "Asha Rai", rollNo: "B23HR09", isLeader: true });
    expect(JSON.stringify(r)).not.toContain("9876543210");
    expect((await fetch(`${base}/api/registrations/not-a-uuid/receipt`)).status).toBe(400);
    expect(
      (await fetch(`${base}/api/registrations/00000000-0000-4000-8000-000000000000/receipt`)).status,
    ).toBe(404);
  });

  it("rejects malformed verify/cancel/status input with 400", async () => {
    expect((await post("/api/registrations/verify-payment", { orderId: "x" })).status).toBe(400);
    expect((await post("/api/registrations/cancel", { registrationId: "nope" })).status).toBe(400);
    expect((await fetch(`${base}/api/registrations/not-a-uuid/status`)).status).toBe(400);
  });
});

describe("razorpay webhook", () => {
  const send = (raw: string, sig?: string) =>
    fetch(`${base}/api/razorpay/webhook`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(sig ? { "x-razorpay-signature": sig } : {}) },
      body: raw,
    });
  const sign = (raw: string) => createHmac("sha256", "hook_secret").update(raw).digest("hex");

  it("rejects missing and forged signatures", async () => {
    expect((await send("{}")).status).toBe(400);
    expect((await send('{"event":"order.paid"}', "deadbeef")).status).toBe(401);
  });

  it("confirms a paid registration from a correctly signed event (raw body preserved)", async () => {
    const members = ["B", "C"].map((x, i) => ({ name: `Member ${x}`, rollNo: `B23FW0${i}` }));
    const start = await (
      await post("/api/registrations", { eventId: "fill-and-burst", teamName: "Splash", leader: leader("B23FW09"), members: [...members, { name: "Member D", rollNo: "B23FW05" }] })
    ).json();
    expect(start).toMatchObject({ status: "payment_required" });
    capturedAmount = start.order.amount;
    // deliberately odd spacing: the signature must be checked on the exact bytes
    const raw = `{ "event": "order.paid", "payload": { "payment": { "entity": { "id": "pay_HOOK1abc", "order_id": "${start.order.id}" } } } }`;
    const res = await send(raw, sign(raw));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("confirmed");
    const status = await (await fetch(`${base}/api/registrations/${start.registrationId}/status`)).json();
    expect(status.status).toBe("confirmed");
  });

  it("ignores events it doesn't handle", async () => {
    const raw = '{"event":"payment.failed"}';
    const res = await send(raw, sign(raw));
    expect(await res.text()).toBe("ignored");
  });
});

describe("admin API", () => {
  it("refuses data without a token", async () => {
    expect((await fetch(`${base}/api/admin/overview`)).status).toBe(401);
    expect((await fetch(`${base}/api/admin/overview`, { headers: { authorization: "Bearer junk" } })).status).toBe(401);
  });

  it("login -> token -> overview, event list and search", async () => {
    const bad = await post("/api/admin/login", { username: "admin-user", password: "nope" });
    expect(bad.status).toBe(401);
    const login = await (await post("/api/admin/login", { username: "admin-user", password: "correct horse battery" })).json();
    expect(login).toMatchObject({ ok: true, username: "admin-user" });
    const auth = { authorization: `Bearer ${login.token}` };

    expect(await (await fetch(`${base}/api/admin/session`, { headers: auth })).json()).toEqual({ username: "admin-user" });
    const overview = await (await fetch(`${base}/api/admin/overview`, { headers: auth })).json();
    expect(overview.ok).toBe(true);
    expect(overview.data.events.find((e: { eventId: string }) => e.eventId === "rangoli").confirmedTeams).toBe(1);

    const list = await (await fetch(`${base}/api/admin/events/rangoli/registrations?status=confirmed`, { headers: auth })).json();
    expect(list.data[0].teamName).toBe("Hues");
    expect((await fetch(`${base}/api/admin/events/unknown/registrations`, { headers: auth })).status).toBe(400);

    const found = await (await fetch(`${base}/api/admin/search?q=B23HR01`, { headers: auth })).json();
    expect(found.data.map((r: { eventId: string }) => r.eventId)).toEqual(["rangoli"]);
    expect((await fetch(`${base}/api/admin/search?q=x`, { headers: auth })).status).toBe(400);
  });

  it("backup-sync accepts the scheduler token and reports Firebase not configured", async () => {
    expect((await post("/api/admin/backup-sync", {})).status).toBe(401);
    const res = await post("/api/admin/backup-sync", {}, { authorization: `Bearer ${"s".repeat(30)}` });
    expect(res.status).toBe(503);
    expect((await res.json()).data).toMatchObject({ configured: false });
  });
});

describe("rate limiting", () => {
  it("limits registration attempts per IP (20 per 10 minutes)", async () => {
    // the limiter is per process, so earlier tests in this file already used part of the quota
    const body = { eventId: "nope", leader: leader("B23RL001"), members: [] };
    const codes: number[] = [];
    for (let i = 0; i < 21; i++) {
      const res = await fetch(`${base}/api/registrations`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      codes.push(res.status);
    }
    const firstBlocked = codes.indexOf(429);
    expect(firstBlocked).toBeGreaterThan(0);
    expect(codes.slice(0, firstBlocked).every((c) => c === 200)).toBe(true);
    expect(codes.slice(firstBlocked).every((c) => c === 429)).toBe(true);
    const blocked = await fetch(`${base}/api/registrations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    expect(await blocked.json()).toMatchObject({ ok: false, message: expect.stringMatching(/Too many/) });
  });
});
