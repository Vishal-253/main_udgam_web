import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EVENTS } from "../src/data/events";
import {
  amountPaise,
  normalizePhone,
  normalizeRollNo,
  registrationSchema,
  teamProblems,
} from "../src/validation/registration";

const event = (id: string) => {
  const e = EVENTS.find((x) => x.id === id);
  if (!e) throw new Error(`no event ${id}`);
  return e;
};

const leader = {
  name: "Asha Rai",
  rollNo: " b23cs001 ",
  email: "Asha@Example.com ",
  phone: "+91 98765-43210",
  year: "2nd Year",
  department: "CSE",
  college: "NIT Sikkim",
};

const team = (
  eventId: string,
  members: { name: string; rollNo: string }[],
  teamName = "Blossoms",
) => registrationSchema.parse({ eventId, teamName, leader, members });

describe("registration validation", () => {
  it("normalises roll numbers, emails and phones", () => {
    const d = team("dumb-charades", [{ name: "Bina", rollNo: "b23 cs 002" }]);
    expect(d.leader.rollNo).toBe("B23CS001");
    expect(d.members[0]?.rollNo).toBe("B23CS002");
    expect(d.leader.email).toBe("asha@example.com");
    expect(d.leader.phone).toBe("9876543210");
    expect(normalizeRollNo(" ab 12 ")).toBe("AB12");
    expect(normalizePhone("09876543210")).toBe("9876543210");
  });

  it("rejects bad leader details", () => {
    const bad = registrationSchema.safeParse({
      eventId: "photography",
      leader: { ...leader, email: "nope", phone: "12345", year: "6th Year", rollNo: "!!" },
      members: [],
    });
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(
      expect.arrayContaining(["leader.email", "leader.phone", "leader.year", "leader.rollNo"]),
    );
  });

  it("enforces exact team sizes (leader included)", () => {
    const rangoli = event("rangoli"); // exactly 4
    const m = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `Member ${"ABCDE"[i]}`, rollNo: `B23R0${i}` }));
    expect(teamProblems(rangoli, team("rangoli", m(3)))).toEqual([]);
    expect(teamProblems(rangoli, team("rangoli", m(2)))[0]).toMatch(/exactly 4/);
    expect(teamProblems(rangoli, team("rangoli", m(4)))[0]).toMatch(/exactly 4/);
  });

  it("allows a range where the rulebook does (wall painting 1-5, fill & burst 4-5)", () => {
    const m = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ name: `Member ${"ABCDE"[i]}`, rollNo: `B23W0${i}` }));
    expect(teamProblems(event("wall-painting"), team("wall-painting", m(0)))).toEqual([]);
    expect(teamProblems(event("wall-painting"), team("wall-painting", m(4)))).toEqual([]);
    expect(teamProblems(event("wall-painting"), team("wall-painting", m(5)))).not.toEqual([]);
    expect(teamProblems(event("fill-and-burst"), team("fill-and-burst", m(2)))).not.toEqual([]);
    expect(teamProblems(event("fill-and-burst"), team("fill-and-burst", m(3)))).toEqual([]);
  });

  it("requires every participant to be a different person", () => {
    const d = team("dumb-charades", [{ name: "Copy", rollNo: "b23CS001" }]);
    expect(teamProblems(event("dumb-charades"), d).join(" ")).toMatch(/B23CS001/);
  });

  it("requires a team name for team events only", () => {
    expect(
      teamProblems(
        event("three-leg-tie"),
        team("three-leg-tie", [{ name: "Bina", rollNo: "B23X02" }], ""),
      ),
    ).toContain("Enter a team name.");
    expect(teamProblems(event("photography"), team("photography", [], ""))).toEqual([]);
  });

  it("computes the amount from event config only", () => {
    expect(amountPaise(event("treasure-hunt"), 4)).toBe(25000); // per team
    expect(amountPaise(event("squid-games"), 1)).toBe(3000); // per person
    expect(amountPaise(event("cup-pong"), 1)).toBe(0); // free
  });

  it("every event has a sane team size", () => {
    for (const e of EVENTS) {
      expect(e.teamSize.min).toBeGreaterThanOrEqual(1);
      expect(e.teamSize.max).toBeGreaterThanOrEqual(e.teamSize.min);
    }
  });
});

// ---------------------------------------------------------------- service (DB + Razorpay mocked)

const dbCalls: string[] = [];
let dbResponder: (query: string, values: unknown[]) => unknown[] = () => [];
vi.mock("../src/db/client", () => ({
  db:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = strings.join("?");
      dbCalls.push(q);
      return Promise.resolve(dbResponder(q, values));
    },
}));

const createOrder = vi.fn();
const ensureCaptured = vi.fn();
vi.mock("../src/services/razorpay", async (orig) => ({
  ...(await orig<typeof import("../src/services/razorpay")>()),
  createOrder: (...a: unknown[]) => createOrder(...a),
  ensureCaptured: (...a: unknown[]) => ensureCaptured(...a),
  publicKeyId: () => "rzp_test_key",
}));

describe("registration service", () => {
  beforeEach(() => {
    dbCalls.length = 0;
    createOrder.mockReset();
    ensureCaptured.mockReset();
    process.env["REGISTRATIONS_OPEN"] = "true";
    process.env["RAZORPAY_KEY_SECRET"] = "test_secret";
    process.env["RAZORPAY_WEBHOOK_SECRET"] = "hook_secret";
  });

  const input = (eventId: string, members: { name: string; rollNo: string }[] = []) => ({
    eventId,
    teamName: "Blossoms",
    leader,
    members,
  });

  it("refuses everything while registrations are closed", async () => {
    process.env["REGISTRATIONS_OPEN"] = "false";
    const { startRegistration } = await import("../src/services/registrations");
    const r = await startRegistration(input("photography"));
    expect(r).toMatchObject({ ok: false, code: "closed" });
    expect(dbCalls).toHaveLength(0);
  });

  it("rejects wrong team size before touching the database", async () => {
    const { startRegistration } = await import("../src/services/registrations");
    const r = await startRegistration(input("rangoli", [{ name: "Bina", rollNo: "B23X02" }]));
    expect(r).toMatchObject({ ok: false, code: "invalid" });
    expect(dbCalls).toHaveLength(0);
  });

  it("confirms free events without creating a payment", async () => {
    dbResponder = () => [
      {
        registration_id: "11111111-1111-4111-8111-111111111111",
        status: "confirmed",
        conflicts: [],
      },
    ];
    const { startRegistration } = await import("../src/services/registrations");
    const r = await startRegistration(input("photography"));
    expect(r).toMatchObject({ ok: true, status: "confirmed" });
    expect(createOrder).not.toHaveBeenCalled();
  });

  it("reports which roll numbers are already registered", async () => {
    dbResponder = () => [
      {
        registration_id: null,
        status: "conflict",
        conflicts: [{ roll_no: "B23X02", pending: false }],
      },
    ];
    const { startRegistration } = await import("../src/services/registrations");
    const r = await startRegistration(input("three-leg-tie", [{ name: "Bina", rollNo: "b23x02" }]));
    expect(r).toMatchObject({
      ok: false,
      code: "conflict",
      conflicts: [{ rollNo: "B23X02", pending: false }],
    });
    expect(r.ok ? "" : r.message).toMatch(/B23X02/);
  });

  it("never opens payment for an order it couldn't link to the registration", async () => {
    const id = "44444444-4444-4444-8444-444444444444";
    dbResponder = (q) =>
      q.includes("udgam_register_team")
        ? [{ registration_id: id, status: "pending", conflicts: [] }]
        : []; // UPDATE ... RETURNING returns no row
    createOrder.mockResolvedValue({
      id: "order_LOST1",
      amount: 25000,
      currency: "INR",
      status: "created",
    });
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { startRegistration } = await import("../src/services/registrations");
    const m = [1, 2].map((i) => ({ name: `Member ${"ABCDE"[i]}`, rollNo: `B23T0${i}` }));
    const r = await startRegistration(input("treasure-hunt", m));
    expect(r).toMatchObject({ ok: false, code: "error" });
    expect(dbCalls.some((q) => q.includes("udgam_cancel_pending"))).toBe(true);
  });

  it("creates a Razorpay order for the server-computed amount", async () => {
    const id = "22222222-2222-4222-8222-222222222222";
    dbResponder = (q) =>
      q.includes("udgam_register_team")
        ? [{ registration_id: id, status: "pending", conflicts: [] }]
        : q.includes("RETURNING id")
          ? [{ id }]
          : [];
    createOrder.mockResolvedValue({
      id: "order_ABC123",
      amount: 25000,
      currency: "INR",
      status: "created",
    });
    const { startRegistration } = await import("../src/services/registrations");
    const m = [1, 2].map((i) => ({ name: `Member ${"ABCDE"[i]}`, rollNo: `B23T0${i}` }));
    const r = await startRegistration({ ...input("treasure-hunt", m), amount: 1 } as never); // client "amount" ignored
    expect(createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ amountPaise: 25000, receipt: id }),
    );
    expect(r).toMatchObject({
      ok: true,
      status: "payment_required",
      order: { id: "order_ABC123", amount: 25000 },
    });
    expect(dbCalls.some((q) => q.includes("UPDATE registrations"))).toBe(true);
  });

  it("releases the held spots if the order cannot be created", async () => {
    const id = "33333333-3333-4333-8333-333333333333";
    dbResponder = (q) =>
      q.includes("udgam_register_team")
        ? [{ registration_id: id, status: "pending", conflicts: [] }]
        : [];
    createOrder.mockRejectedValue(new Error("razorpay down"));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { startRegistration } = await import("../src/services/registrations");
    const m = [1, 2].map((i) => ({ name: `Member ${"ABCDE"[i]}`, rollNo: `B23T0${i}` }));
    const r = await startRegistration(input("treasure-hunt", m));
    expect(r).toMatchObject({ ok: false, code: "error" });
    expect(dbCalls.some((q) => q.includes("udgam_cancel_pending"))).toBe(true);
  });

  it("only confirms a payment Razorpay says was captured", async () => {
    dbResponder = (q) =>
      q.includes("FROM registrations WHERE razorpay_order_id")
        ? [{ id: "r1", status: "pending", amount_paise: 25000 }]
        : [{ registration_id: "r1", status: "confirmed" }];
    ensureCaptured.mockResolvedValue(null);
    const { confirmPaidOrder } = await import("../src/services/registrations");
    expect(await confirmPaidOrder("order_X", "pay_X")).toMatchObject({
      ok: false,
      code: "invalid",
    });
    expect(dbCalls.some((q) => q.includes("udgam_confirm_payment"))).toBe(false);

    ensureCaptured.mockResolvedValue(25000);
    expect(await confirmPaidOrder("order_X", "pay_X")).toMatchObject({
      ok: true,
      status: "confirmed",
    });
  });

  it("verifies checkout and webhook signatures (and rejects tampering)", async () => {
    const { verifyCheckoutSignature, verifyWebhookSignature } =
      await import("../src/services/razorpay");
    const good = createHmac("sha256", "test_secret").update("order_1|pay_1").digest("hex");
    expect(await verifyCheckoutSignature("order_1", "pay_1", good)).toBe(true);
    expect(await verifyCheckoutSignature("order_1", "pay_2", good)).toBe(false);
    const body = '{"event":"order.paid"}';
    const hook = createHmac("sha256", "hook_secret").update(body).digest("hex");
    expect(await verifyWebhookSignature(body, hook)).toBe(true);
    expect(await verifyWebhookSignature(body + " ", hook)).toBe(false);
  });
});
