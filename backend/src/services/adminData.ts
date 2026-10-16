import { EVENTS } from "../data/events";
import type {
  AdminMember,
  AdminOverview,
  AdminRegistration,
  RegistrationStatus,
} from "../types";
import { db } from "../db/client";
import { firestoreConfig } from "./firestore";

// Read-only queries for the admin panel. Callers must check requireAdmin() first.

const eventNames = new Map(EVENTS.map((e) => [e.id, e.name]));

interface RegRow {
  id: string;
  event_id: string;
  team_name: string | null;
  status: RegistrationStatus;
  amount_paise: number;
  members: AdminMember[];
  leader_roll_no: string;
  leader_email: string;
  leader_phone: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  created_at: Date | string;
  confirmed_at: Date | string | null;
  expires_at: Date | string | null;
}

const iso = (v: Date | string | null): string | null =>
  v === null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString();

function toRegistration(r: RegRow): AdminRegistration {
  return {
    id: r.id,
    eventId: r.event_id,
    eventName: eventNames.get(r.event_id) ?? r.event_id,
    teamName: r.team_name,
    status: r.status,
    amountPaise: r.amount_paise,
    members: Array.isArray(r.members) ? r.members : [],
    leaderRollNo: r.leader_roll_no,
    leaderEmail: r.leader_email,
    leaderPhone: r.leader_phone,
    razorpayOrderId: r.razorpay_order_id,
    razorpayPaymentId: r.razorpay_payment_id,
    createdAt: iso(r.created_at) ?? "",
    confirmedAt: iso(r.confirmed_at),
    expiresAt: iso(r.expires_at),
  };
}

const COLUMNS = `id, event_id, team_name, status, amount_paise, members, leader_roll_no, leader_email,
  leader_phone, razorpay_order_id, razorpay_payment_id, created_at, confirmed_at, expires_at`;

export async function getOverview(): Promise<AdminOverview> {
  const sql = db();
  const [stats, unique, recent, refunds, unsynced] = await Promise.all([
    sql`
      SELECT event_id,
             count(*) FILTER (WHERE status = 'confirmed')::int                                    AS confirmed_teams,
             COALESCE(sum(jsonb_array_length(members)) FILTER (WHERE status = 'confirmed'), 0)::int AS confirmed_participants,
             count(*) FILTER (WHERE status = 'pending' AND expires_at > now())::int                AS pending_teams,
             count(*) FILTER (WHERE status = 'refund_required')::int                              AS refunds,
             COALESCE(sum(amount_paise) FILTER (WHERE status = 'confirmed'), 0)::bigint            AS revenue_paise,
             max(confirmed_at)                                                                     AS last_confirmed_at
        FROM registrations
       GROUP BY event_id` as unknown as Promise<
      {
        event_id: string;
        confirmed_teams: number;
        confirmed_participants: number;
        pending_teams: number;
        refunds: number;
        revenue_paise: string | number;
        last_confirmed_at: Date | string | null;
      }[]
    >,
    sql`
      SELECT count(DISTINCT m ->> 'roll_no')::int AS n
        FROM registrations r, jsonb_array_elements(r.members) m
       WHERE r.status = 'confirmed'` as unknown as Promise<{ n: number }[]>,
    sql.query(
      `SELECT ${COLUMNS} FROM registrations WHERE status = 'confirmed' ORDER BY confirmed_at DESC LIMIT 15`,
    ) as unknown as Promise<RegRow[]>,
    sql.query(
      `SELECT ${COLUMNS} FROM registrations WHERE status = 'refund_required' ORDER BY updated_at DESC`,
    ) as unknown as Promise<RegRow[]>,
    sql`SELECT count(*)::int AS n FROM udgam_unsynced` as unknown as Promise<{ n: number }[]>,
  ]);

  const byEvent = new Map(stats.map((s) => [s.event_id, s]));
  const events = EVENTS.map((e) => {
    const s = byEvent.get(e.id);
    return {
      eventId: e.id,
      eventName: e.name,
      tier: e.tier,
      fee: e.fee,
      feeUnit: e.feeUnit ?? null,
      teamSize: e.teamSize,
      confirmedTeams: s?.confirmed_teams ?? 0,
      confirmedParticipants: s?.confirmed_participants ?? 0,
      pendingTeams: s?.pending_teams ?? 0,
      refunds: s?.refunds ?? 0,
      revenuePaise: Number(s?.revenue_paise ?? 0),
      lastConfirmedAt: iso(s?.last_confirmed_at ?? null),
    };
  });

  const sum = (
    k: "confirmedTeams" | "confirmedParticipants" | "pendingTeams" | "revenuePaise" | "refunds",
  ) => events.reduce((n, e) => n + e[k], 0);

  return {
    events,
    totals: {
      confirmedTeams: sum("confirmedTeams"),
      confirmedParticipants: sum("confirmedParticipants"),
      uniqueParticipants: unique[0]?.n ?? 0,
      pendingTeams: sum("pendingTeams"),
      revenuePaise: sum("revenuePaise"),
      refunds: sum("refunds"),
    },
    recent: recent.map(toRegistration),
    refunds: refunds.map(toRegistration),
    backup: { configured: firestoreConfig() !== null, unsynced: unsynced[0]?.n ?? 0 },
    generatedAt: new Date().toISOString(),
  };
}

export async function getEventRegistrations(
  eventId: string,
  status: RegistrationStatus | "all",
): Promise<AdminRegistration[]> {
  const rows = (await db().query(
    `SELECT ${COLUMNS} FROM registrations
      WHERE event_id = $1 AND ($2 = 'all' OR status = $2)
      ORDER BY COALESCE(confirmed_at, created_at), created_at`,
    [eventId, status],
  )) as RegRow[];
  return rows.map(toRegistration);
}

/** Finds registrations by roll number, name, team, email, phone, payment/order/registration id. */
export async function searchRegistrations(q: string): Promise<AdminRegistration[]> {
  const term = q.trim();
  // escape LIKE wildcards so user input is matched literally
  const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const rows = (await db().query(
    `SELECT ${COLUMNS} FROM registrations r
      WHERE r.team_name ILIKE $1 OR r.leader_email ILIKE $1 OR r.leader_phone ILIKE $1
         OR r.razorpay_payment_id = $2 OR r.razorpay_order_id = $2 OR r.id::text = $2
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(r.members) m
                     WHERE m ->> 'roll_no' ILIKE $1 OR m ->> 'name' ILIKE $1)
      ORDER BY r.created_at DESC
      LIMIT 100`,
    [pattern, term],
  )) as RegRow[];
  return rows.map(toRegistration);
}
