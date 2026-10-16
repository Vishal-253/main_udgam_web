import { EVENTS } from "../data/events";
import {
  amountPaise,
  registrationSchema,
  teamProblems,
} from "../validation/registration";
import { backupRegistration } from "./backup";
import { db } from "../db/client";
import { registrationsOpen } from "../config/env";
import { createOrder, ensureCaptured, publicKeyId } from "./razorpay";

// All registration rules live here; routes/registrations.ts (browser API) and the Razorpay
// webhook route are thin wrappers around it. Hard guarantees (one spot per roll number per
// event, atomic writes, race safety) are enforced by the SQL functions in db/schema.sql.

/** How long an unpaid registration holds its participants' spots. */
export const HOLD_MINUTES = 20;

export type Conflict = { rollNo: string; pending: boolean };

export type StartRegistrationResult =
  | { ok: true; status: "confirmed"; registrationId: string; eventName: string }
  | {
      ok: true;
      status: "payment_required";
      registrationId: string;
      eventName: string;
      holdMinutes: number;
      order: { id: string; amount: number; currency: "INR"; keyId: string };
      prefill: { name: string; email: string; contact: string };
    }
  | {
      ok: false;
      code: "closed" | "invalid" | "conflict" | "error";
      message: string;
      problems?: string[];
      conflicts?: Conflict[];
    };

export type PaymentResult =
  | { ok: true; status: "confirmed"; registrationId: string }
  | { ok: false; code: "invalid" | "refund_required" | "not_found" | "error"; message: string };

const GENERIC_ERROR = "Something went wrong on our side. Please try again in a minute.";

interface RegisterRow {
  registration_id: string | null;
  status: "confirmed" | "pending" | "conflict";
  conflicts: { roll_no: string; pending: boolean }[];
}

export async function startRegistration(raw: unknown): Promise<StartRegistrationResult> {
  if (!registrationsOpen()) {
    return {
      ok: false,
      code: "closed",
      message: "Registrations are not open yet. Please check back soon.",
    };
  }

  const parsed = registrationSchema.safeParse(raw);
  if (!parsed.success) {
    const problems = [...new Set(parsed.error.issues.map((i) => i.message))];
    return { ok: false, code: "invalid", message: "Please fix the highlighted details.", problems };
  }
  const data = parsed.data;

  const event = EVENTS.find((e) => e.id === data.eventId);
  if (!event) {
    return {
      ok: false,
      code: "invalid",
      message: "This event no longer exists. Please refresh the page.",
    };
  }

  if (event.fee === null) {
    return {
      ok: false,
      code: "closed",
      message: `Registration for ${event.name} opens once its entry fee is announced.`,
    };
  }

  const problems = teamProblems(event, data);
  if (problems.length) {
    return { ok: false, code: "invalid", message: problems[0] ?? "Invalid team.", problems };
  }

  const teamSize = 1 + data.members.length;
  const amount = amountPaise(event, teamSize);
  const { leader } = data;
  const members = [
    {
      is_leader: true,
      name: leader.name,
      roll_no: leader.rollNo,
      email: leader.email,
      phone: leader.phone,
      year: leader.year,
      department: leader.department,
      college: leader.college,
    },
    ...data.members.map((m) => ({ is_leader: false, name: m.name, roll_no: m.rollNo })),
  ];

  let row: RegisterRow | undefined;
  try {
    const rows = (await db()`
      SELECT * FROM udgam_register_team(
        ${event.id}, ${data.teamName || null}, ${amount}, ${JSON.stringify(members)}::jsonb,
        ${leader.rollNo}, ${leader.email}, ${leader.phone}, ${HOLD_MINUTES}
      )`) as RegisterRow[];
    row = rows[0];
  } catch (err) {
    // 23505 = unique violation: only reachable if the per-event lock was somehow bypassed
    if ((err as { code?: string }).code === "23505") {
      return {
        ok: false,
        code: "conflict",
        message: "One of these participants is already registered for this event.",
      };
    }
    console.error("[registration] register_team failed", event.id, err);
    return { ok: false, code: "error", message: GENERIC_ERROR };
  }

  if (!row) {
    console.error("[registration] register_team returned no row", event.id);
    return { ok: false, code: "error", message: GENERIC_ERROR };
  }

  if (row.status === "conflict") {
    const conflicts = row.conflicts.map((c) => ({ rollNo: c.roll_no, pending: c.pending }));
    const confirmed = conflicts.filter((c) => !c.pending).map((c) => c.rollNo);
    const pending = conflicts.filter((c) => c.pending).map((c) => c.rollNo);
    const parts: string[] = [];
    if (confirmed.length) {
      parts.push(`Already registered for ${event.name}: ${confirmed.join(", ")}.`);
    }
    if (pending.length) {
      parts.push(
        `${pending.join(", ")} ${pending.length === 1 ? "is" : "are"} in another team whose payment is in progress. ` +
          `If that team doesn't pay within ${HOLD_MINUTES} minutes the spot is released.`,
      );
    }
    return { ok: false, code: "conflict", message: parts.join(" "), conflicts };
  }

  const registrationId = row.registration_id;
  if (!registrationId) {
    console.error("[registration] register_team returned no id", event.id);
    return { ok: false, code: "error", message: GENERIC_ERROR };
  }

  if (row.status === "confirmed") {
    await backupRegistration(registrationId);
    return { ok: true, status: "confirmed", registrationId, eventName: event.name };
  }

  // Paid event: create the Razorpay order for the server-computed amount
  let order: { id: string; amount: number; keyId: string };
  try {
    const keyId = publicKeyId(); // fail before creating an order if config is missing
    const created = await createOrder({
      amountPaise: amount,
      receipt: registrationId,
      notes: { registration_id: registrationId, event_id: event.id, leader_roll_no: leader.rollNo },
    });
    const attached = (await db()`
      UPDATE registrations
         SET razorpay_order_id = ${created.id}
       WHERE id = ${registrationId}::uuid AND status = 'pending' AND razorpay_order_id IS NULL
      RETURNING id`) as { id: string }[];
    if (attached.length !== 1) {
      // never show a payment window for an order we couldn't link to the registration
      throw new Error(`could not attach order ${created.id} to registration ${registrationId}`);
    }
    order = { id: created.id, amount: created.amount, keyId };
  } catch (err) {
    console.error("[registration] order creation failed; releasing spots", registrationId, err);
    // free the held spots so the team can retry immediately
    await db()`SELECT udgam_cancel_pending(${registrationId}::uuid, ${leader.rollNo})`.catch((e) =>
      console.error("[registration] release after order failure failed", registrationId, e),
    );
    await backupRegistration(registrationId);
    return { ok: false, code: "error", message: "Couldn't start the payment. Please try again." };
  }

  // outside the try: the order is linked, so nothing below may cancel the registration
  await backupRegistration(registrationId);
  return {
    ok: true,
    status: "payment_required",
    registrationId,
    eventName: event.name,
    holdMinutes: HOLD_MINUTES,
    order: { id: order.id, amount: order.amount, currency: "INR", keyId: order.keyId },
    prefill: { name: leader.name, email: leader.email, contact: leader.phone },
  };
}

/**
 * Marks the registration behind `orderId` as paid, after confirming with Razorpay that the
 * payment really was captured for that order. Idempotent — the browser callback and the
 * webhook may both call it.
 */
export async function confirmPaidOrder(orderId: string, paymentId: string): Promise<PaymentResult> {
  const regs = (await db()`
    SELECT id, status, amount_paise FROM registrations WHERE razorpay_order_id = ${orderId}`) as {
    id: string;
    status: string;
    amount_paise: number;
  }[];
  const reg = regs[0];
  if (!reg) {
    console.error("[registration] payment for unknown order — check Razorpay, may need refund", {
      orderId,
      paymentId,
    });
    return { ok: false, code: "not_found", message: "We couldn't find this registration." };
  }
  if (reg.status === "confirmed") return { ok: true, status: "confirmed", registrationId: reg.id };

  const paid = await ensureCaptured(paymentId, orderId, reg.amount_paise);
  if (paid === null) {
    return {
      ok: false,
      code: "invalid",
      message:
        "We couldn't verify this payment. If money was deducted, it will be refunded automatically.",
    };
  }

  const rows = (await db()`
    SELECT * FROM udgam_confirm_payment(${orderId}, ${paymentId}, ${paid})`) as {
    registration_id: string | null;
    status: string;
  }[];
  const result = rows[0];
  if (result?.registration_id) await backupRegistration(result.registration_id);
  if (result?.status === "confirmed" && result.registration_id) {
    return { ok: true, status: "confirmed", registrationId: result.registration_id };
  }
  if (result?.status === "refund_required") {
    console.error("[registration] REFUND REQUIRED", {
      orderId,
      paymentId,
      registrationId: result.registration_id,
    });
    return {
      ok: false,
      code: "refund_required",
      message:
        "Your payment was received, but your registration had expired and a team member's spot was taken meanwhile. " +
        "The organisers will refund you — please contact the events team with your payment ID.",
    };
  }
  console.error("[registration] unexpected confirm result", { orderId, paymentId, result });
  return { ok: false, code: "error", message: GENERIC_ERROR };
}

export async function cancelPending(registrationId: string, leaderRollNo: string): Promise<string> {
  const rows = (await db()`
    SELECT udgam_cancel_pending(${registrationId}::uuid, ${leaderRollNo}) AS status`) as {
    status: string;
  }[];
  const status = rows[0]?.status ?? "not_found";
  if (status === "cancelled") await backupRegistration(registrationId);
  return status;
}

export async function registrationStatus(
  registrationId: string,
): Promise<{ status: string; eventId: string } | null> {
  const rows = (await db()`
    SELECT status, event_id FROM registrations WHERE id = ${registrationId}::uuid`) as {
    status: string;
    event_id: string;
  }[];
  const r = rows[0];
  return r ? { status: r.status, eventId: r.event_id } : null;
}

export interface RegistrationReceipt {
  registrationId: string;
  eventId: string;
  eventName: string;
  teamName: string | null;
  status: string;
  amountPaise: number;
  members: { name: string; rollNo: string; isLeader: boolean }[];
  leaderEmail: string;
  leaderPhone: string;
  paymentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

const maskEmail = (e: string) => {
  const [user = "", domain = ""] = e.split("@");
  return `${user.slice(0, 2)}${"*".repeat(Math.max(1, user.length - 2))}@${domain}`;
};
const maskPhone = (p: string) => `${"*".repeat(Math.max(0, p.length - 4))}${p.slice(-4)}`;
const isoOrNull = (v: Date | string | null) => (v === null ? null : new Date(v).toISOString());

/**
 * Receipt for the registration page. The id is an unguessable UUID; contact details are masked
 * anyway so a leaked receipt link exposes nothing beyond names and roll numbers.
 */
export async function registrationReceipt(registrationId: string): Promise<RegistrationReceipt | null> {
  const rows = (await db()`
    SELECT id, event_id, team_name, status, amount_paise, members, leader_email, leader_phone,
           razorpay_payment_id, created_at, confirmed_at
      FROM registrations WHERE id = ${registrationId}::uuid`) as {
    id: string;
    event_id: string;
    team_name: string | null;
    status: string;
    amount_paise: number;
    members: { name: string; roll_no: string; is_leader?: boolean }[];
    leader_email: string;
    leader_phone: string;
    razorpay_payment_id: string | null;
    created_at: Date | string;
    confirmed_at: Date | string | null;
  }[];
  const r = rows[0];
  if (!r) return null;
  return {
    registrationId: r.id,
    eventId: r.event_id,
    eventName: EVENTS.find((e) => e.id === r.event_id)?.name ?? r.event_id,
    teamName: r.team_name,
    status: r.status,
    amountPaise: r.amount_paise,
    members: (Array.isArray(r.members) ? r.members : []).map((m) => ({
      name: m.name,
      rollNo: m.roll_no,
      isLeader: m.is_leader === true,
    })),
    leaderEmail: maskEmail(r.leader_email),
    leaderPhone: maskPhone(r.leader_phone),
    paymentId: r.razorpay_payment_id,
    createdAt: isoOrNull(r.created_at) ?? "",
    confirmedAt: isoOrNull(r.confirmed_at),
  };
}
