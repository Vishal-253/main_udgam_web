// Runs the real registration service, admin queries and admin login against a real Postgres
// (PGlite, in-process) loaded with db/schema.sql. Only Razorpay and Firebase are mocked.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

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

// Razorpay: orders always succeed; captured amount is controlled per test
let orderSeq = 0;
let capturedAmount: number | null = null;
vi.mock("../src/services/razorpay", () => ({
  createOrder: vi.fn(async ({ amountPaise }: { amountPaise: number }) => ({
    id: `order_TEST${++orderSeq}`,
    amount: amountPaise,
    currency: "INR",
    status: "created",
  })),
  ensureCaptured: vi.fn(async () => capturedAmount),
  publicKeyId: () => "rzp_test_key",
}));

// Firebase backup is exercised in backup.test.ts; here it is simply not configured
vi.mock("../src/services/firestore", () => ({
  firestoreConfig: () => null,
  upsertVersioned: vi.fn(),
}));

const { startRegistration, confirmPaidOrder } = await import("../src/services/registrations");
const { getOverview, getEventRegistrations, searchRegistrations } =
  await import("../src/services/adminData");
const { adminLogin, verifyAdminToken } = await import("../src/services/adminAuth");

const leader = (roll: string, name = "Asha Rai") => ({
  name,
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
  process.env["REGISTRATIONS_OPEN"] = "true";
  process.env["ADMIN_USERNAME"] = "admin-user";
  process.env["ADMIN_PASSWORD"] = "correct horse battery";
  process.env["ADMIN_SESSION_SECRET"] = "x".repeat(40);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

describe("registration flow on a real database", () => {
  it("registers a free individual event and blocks the same student twice", async () => {
    const first = await startRegistration({
      eventId: "photography",
      leader: leader("B23CS001"),
      members: [],
    });
    expect(first).toMatchObject({ ok: true, status: "confirmed" });
    const again = await startRegistration({
      eventId: "photography",
      // same student typed differently (spaces, lower case) must still be caught
      leader: { ...leader("B23CS001", "Someone Else"), rollNo: " b23 cs001 " },
      members: [],
    });
    expect(again).toMatchObject({ ok: false, code: "conflict" });
  });

  it("blocks a member who is already in another team of the same event", async () => {
    const a = await startRegistration({
      eventId: "dumb-charades",
      teamName: "Mimes",
      leader: leader("B23CS010"),
      members: [{ name: "Bina Lama", rollNo: "B23CS011" }],
    });
    expect(a).toMatchObject({ ok: true, status: "confirmed" });
    const b = await startRegistration({
      eventId: "dumb-charades",
      teamName: "Actors",
      leader: leader("B23CS020"),
      members: [{ name: "Bina Lama", rollNo: "B23CS011" }],
    });
    expect(b).toMatchObject({
      ok: false,
      code: "conflict",
      conflicts: [{ rollNo: "B23CS011", pending: false }],
    });
  });

  it("paid event: pending -> confirmed after a captured payment, counted in revenue", async () => {
    const members = ["B", "C", "D"].map((x, i) => ({ name: `Member ${x}`, rollNo: `B23RG0${i}` }));
    const start = await startRegistration({
      eventId: "rangoli",
      teamName: "Colours",
      leader: leader("B23RG09"),
      members,
    });
    expect(start).toMatchObject({ ok: true, status: "payment_required", order: { amount: 8000 } });
    if (!start.ok || start.status !== "payment_required") throw new Error("unexpected");

    capturedAmount = null; // Razorpay says not captured
    expect(await confirmPaidOrder(start.order.id, "pay_TEST1")).toMatchObject({
      ok: false,
      code: "invalid",
    });

    capturedAmount = 8000;
    expect(await confirmPaidOrder(start.order.id, "pay_TEST1")).toMatchObject({
      ok: true,
      status: "confirmed",
    });
    expect(await confirmPaidOrder(start.order.id, "pay_TEST1")).toMatchObject({ ok: true }); // idempotent
  });

  it("rejects a team of the wrong size before writing anything", async () => {
    const before = (await run("select count(*)::int n from registrations"))[0] as { n: number };
    const r = await startRegistration({
      eventId: "rangoli",
      teamName: "Too small",
      leader: leader("B23RG50"),
      members: [{ name: "Only One", rollNo: "B23RG51" }],
    });
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    const after = (await run("select count(*)::int n from registrations"))[0] as { n: number };
    expect(after.n).toBe(before.n);
  });
});

describe("admin queries", () => {
  it("overview counts teams, participants, unique students and revenue", async () => {
    const o = await getOverview();
    const rangoli = o.events.find((e) => e.eventId === "rangoli");
    expect(rangoli).toMatchObject({
      confirmedTeams: 1,
      confirmedParticipants: 4,
      revenuePaise: 8000,
    });
    const charades = o.events.find((e) => e.eventId === "dumb-charades");
    expect(charades).toMatchObject({
      confirmedTeams: 1,
      confirmedParticipants: 2,
      revenuePaise: 0,
    });
    expect(o.events).toHaveLength(29); // every event listed, even with no registrations
    expect(o.totals).toMatchObject({
      confirmedTeams: 3,
      confirmedParticipants: 7,
      revenuePaise: 8000,
    });
    expect(o.totals.uniqueParticipants).toBe(7);
    expect(o.recent.length).toBe(3);
    expect(o.backup).toEqual({ configured: false, unsynced: expect.any(Number) });
  });

  it("lists an event's teams with members, filtered by status", async () => {
    const confirmed = await getEventRegistrations("rangoli", "confirmed");
    expect(confirmed).toHaveLength(1);
    expect(confirmed[0]).toMatchObject({
      teamName: "Colours",
      eventName: "Rangoli",
      status: "confirmed",
    });
    expect(confirmed[0]?.members.map((m) => m.roll_no)).toEqual([
      "B23RG09",
      "B23RG00",
      "B23RG01",
      "B23RG02",
    ]);
    expect(confirmed[0]?.members[0]).toMatchObject({
      is_leader: true,
      phone: "9876543210",
      college: "NIT Sikkim",
    });
    expect(await getEventRegistrations("rangoli", "pending")).toHaveLength(0);
  });

  it("searches by roll number, partial name, team and payment id; wildcards are literal", async () => {
    expect((await searchRegistrations("b23cs011")).map((r) => r.eventId)).toEqual([
      "dumb-charades",
    ]);
    expect((await searchRegistrations("bina")).length).toBe(1);
    expect((await searchRegistrations("Colours"))[0]?.eventId).toBe("rangoli");
    expect((await searchRegistrations("pay_TEST1"))[0]?.eventId).toBe("rangoli");
    expect(await searchRegistrations("%")).toHaveLength(0);
    expect(await searchRegistrations("_")).toHaveLength(0);
  });

});

describe("admin login", () => {
  it("rejects wrong credentials and issues no token", async () => {
    const a = await adminLogin("admin-user", "wrong", "10.0.0.2");
    const b = await adminLogin("someone", "correct horse battery", "10.0.0.2");
    expect(a).toMatchObject({ ok: false });
    expect(b).toMatchObject({ ok: false });
    expect("token" in a || "token" in b).toBe(false);
    expect(await verifyAdminToken(undefined)).toBeNull();
  });

  it("issues a token that verifies until it is tampered with", async () => {
    const r = await adminLogin("admin-user", "correct horse battery", "10.0.0.3");
    if (!r.ok) throw new Error("login failed");
    expect(await verifyAdminToken(r.token)).toBe("admin-user");
    const [payload, sig] = r.token.split(".");
    const forged = Buffer.from(JSON.stringify({ u: "admin-user", exp: Date.now() + 1e9 })).toString(
      "base64url",
    );
    expect(await verifyAdminToken(`${forged}.${sig}`)).toBeNull();
    expect(await verifyAdminToken(`${payload}.AAAA`)).toBeNull();
    expect(await verifyAdminToken("garbage")).toBeNull();
  });

  it("changing the password invalidates issued tokens", async () => {
    const r = await adminLogin("admin-user", "correct horse battery", "10.0.0.5");
    if (!r.ok) throw new Error("login failed");
    process.env["ADMIN_PASSWORD"] = "a new password";
    expect(await verifyAdminToken(r.token)).toBeNull();
    process.env["ADMIN_PASSWORD"] = "correct horse battery";
    expect(await verifyAdminToken(r.token)).toBe("admin-user");
  });

  it("locks an IP out after 5 failures, even with the right password", async () => {
    for (let i = 0; i < 5; i++) await adminLogin("admin-user", "nope", "10.0.0.6");
    const r = await adminLogin("admin-user", "correct horse battery", "10.0.0.6");
    expect(r).toMatchObject({ ok: false, message: expect.stringMatching(/Too many/) });
    expect(await adminLogin("admin-user", "correct horse battery", "10.0.0.7")).toMatchObject({
      ok: true,
    });
  });

  it("is disabled when the session secret is too short", async () => {
    process.env["ADMIN_SESSION_SECRET"] = "short";
    expect(await adminLogin("admin-user", "correct horse battery", "10.0.0.8")).toMatchObject({
      ok: false,
      message: expect.stringMatching(/not configured/),
    });
    process.env["ADMIN_SESSION_SECRET"] = "x".repeat(40);
  });
});
