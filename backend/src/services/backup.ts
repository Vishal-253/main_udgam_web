import { EVENTS } from "../data/events";
import { db } from "../db/client";
import { firestoreConfig, upsertVersioned } from "./firestore";

// Second copy of every registration in Firebase (Firestore collection "registrations").
//
// Neon is the source of truth: it enforces the rules (one spot per roll number per event, locking,
// payments). Firestore holds a mirror for safety. Every change bumps `registrations.version`;
// a registration counts as backed up only once that exact version is in Firestore
// (firebase_sync.synced_version). Anything not yet backed up — because Firebase was down, slow,
// or the change happened inside SQL (hold expiry) — is listed by the udgam_unsynced view and
// copied by syncPending(), which runs from the webhook and the /api/admin/backup-sync endpoint.
//
// Backups never throw and never block or fail a registration.

const COLLECTION = "registrations";
const PER_REGISTRATION_TIMEOUT_MS = 6000;
const eventNames = new Map(EVENTS.map((e) => [e.id, e.name]));

interface RegistrationRow {
  id: string;
  version: string | number;
  event_id: string;
  team_name: string | null;
  status: string;
  amount_paise: number;
  members: unknown;
  leader_roll_no: string;
  leader_email: string;
  leader_phone: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  expires_at: Date | string | null;
  confirmed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const asDate = (v: Date | string | null) =>
  v === null ? null : v instanceof Date ? v : new Date(v);

let warnedUnconfigured = false;
function warnUnconfigured() {
  if (warnedUnconfigured) return;
  warnedUnconfigured = true;
  console.error(
    "[backup] FIREBASE_* not configured — registrations are NOT being backed up to Firebase",
  );
}

/** Copies the CURRENT state of one registration to Firestore. Returns true if it is backed up. */
export async function backupRegistration(registrationId: string): Promise<boolean> {
  const sa = firestoreConfig();
  if (!sa) {
    warnUnconfigured();
    return false;
  }
  try {
    // read the latest row at sync time, so a slow sync can't write stale data as "current"
    const rows = (await db()`
      SELECT id, version, event_id, team_name, status, amount_paise, members, leader_roll_no,
             leader_email, leader_phone, razorpay_order_id, razorpay_payment_id,
             expires_at, confirmed_at, created_at, updated_at
        FROM registrations WHERE id = ${registrationId}::uuid`) as RegistrationRow[];
    const r = rows[0];
    if (!r) return false;
    const version = Number(r.version);

    await withTimeout(
      upsertVersioned(sa, COLLECTION, r.id, version, {
        registrationId: r.id,
        eventId: r.event_id,
        eventName: eventNames.get(r.event_id) ?? r.event_id,
        teamName: r.team_name,
        status: r.status,
        amountPaise: r.amount_paise,
        members: r.members,
        leaderRollNo: r.leader_roll_no,
        leaderEmail: r.leader_email,
        leaderPhone: r.leader_phone,
        razorpayOrderId: r.razorpay_order_id,
        razorpayPaymentId: r.razorpay_payment_id,
        expiresAt: asDate(r.expires_at),
        confirmedAt: asDate(r.confirmed_at),
        createdAt: asDate(r.created_at),
        updatedAt: asDate(r.updated_at),
        backedUpAt: new Date(),
      }),
      PER_REGISTRATION_TIMEOUT_MS,
    );
    // Firestore now has `version` (or newer). Recording it never moves backwards.
    await db()`SELECT udgam_mark_synced(${r.id}::uuid, ${version})`;
    return true;
  } catch (err) {
    console.error("[backup] Firebase backup failed; will retry", registrationId, err);
    const message = err instanceof Error ? err.message : String(err);
    await db()`SELECT udgam_mark_sync_failed(${registrationId}::uuid, ${message})`.catch(
      () => undefined,
    );
    return false;
  }
}

/** Backs up registrations that changed since their last backup; least-recently-tried first, so
 *  one record that keeps failing can't block the others. */
export async function syncPending(limit: number): Promise<{
  configured: boolean;
  synced: number;
  failed: number;
  remaining: number;
}> {
  if (!firestoreConfig()) {
    warnUnconfigured();
    return { configured: false, synced: 0, failed: 0, remaining: await countUnsynced() };
  }
  const rows = (await db()`
    SELECT id FROM udgam_unsynced
     ORDER BY last_attempt_at NULLS FIRST, updated_at
     LIMIT ${limit}`) as { id: string }[];
  let synced = 0;
  let failed = 0;
  for (const { id } of rows) {
    if (await backupRegistration(id)) synced++;
    else failed++;
  }
  return { configured: true, synced, failed, remaining: await countUnsynced() };
}

async function countUnsynced(): Promise<number> {
  const rows = (await db()`SELECT count(*)::int AS n FROM udgam_unsynced`) as { n: number }[];
  return rows[0]?.n ?? 0;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
