-- =============================================================================
-- Udgam 2K26 — event registration schema (PostgreSQL 13+, e.g. Neon)
--
-- Run once against your database:   psql "$DATABASE_URL" -f db/schema.sql
-- Safe to re-run: tables use IF NOT EXISTS and functions use CREATE OR REPLACE.
--
-- Guarantees enforced by the database itself (not just the app):
--   * A roll number can hold at most ONE active spot per event
--     (UNIQUE (event_id, roll_no) on participants) — across all teams.
--   * Registrations for the same event are serialised with an advisory lock,
--     so two teams racing for the same player cannot both get in.
--   * Every multi-step change runs inside a single function call = one
--     transaction, so a half-written registration can never exist.
--
-- Lifecycle of a registration:
--   free event   -> 'confirmed' immediately
--   paid event   -> 'pending' (spots held until expires_at) -> 'confirmed' on payment
--   pending past expires_at -> 'expired' (spots released) — a late payment
--     re-takes the spots if still free, otherwise -> 'refund_required'
--   pending cancelled by the leader -> 'cancelled' (spots released)
-- =============================================================================

CREATE TABLE IF NOT EXISTS registrations (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text        NOT NULL,
  team_name           text,
  status              text        NOT NULL
                      CHECK (status IN ('pending', 'confirmed', 'expired', 'cancelled', 'refund_required')),
  amount_paise        integer     NOT NULL CHECK (amount_paise >= 0),
  -- full snapshot of the team as submitted (leader first); used to restore
  -- spots if a payment arrives after the hold expired
  members             jsonb       NOT NULL CHECK (jsonb_typeof(members) = 'array'),
  leader_roll_no      text        NOT NULL,
  leader_email        text        NOT NULL,
  leader_phone        text        NOT NULL,
  razorpay_order_id   text UNIQUE,
  razorpay_payment_id text UNIQUE,
  expires_at          timestamptz,
  confirmed_at        timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS registrations_event_status_idx ON registrations (event_id, status);

-- Every UPDATE bumps `version` (and updated_at), including manual edits in a SQL console.
-- The Firebase backup uses it so an older copy can never overwrite a newer one.
ALTER TABLE registrations ADD COLUMN IF NOT EXISTS version bigint NOT NULL DEFAULT 1;

CREATE OR REPLACE FUNCTION udgam_bump_version() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  NEW.version := OLD.version + 1;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_bump_version ON registrations;
CREATE TRIGGER registrations_bump_version
  BEFORE UPDATE ON registrations
  FOR EACH ROW EXECUTE FUNCTION udgam_bump_version();

-- Registrations are never deleted (expired/cancelled ones keep their row with a status).
-- This blocks accidental DELETEs; drop the trigger deliberately if you ever really need to.
CREATE OR REPLACE FUNCTION udgam_forbid_delete() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'registrations are append-only; deleting % is not allowed', OLD.id;
END;
$$;

DROP TRIGGER IF EXISTS registrations_no_delete ON registrations;
CREATE TRIGGER registrations_no_delete
  BEFORE DELETE ON registrations
  FOR EACH ROW EXECUTE FUNCTION udgam_forbid_delete();

-- Which version of each registration is safely copied to Firebase (Firestore).
-- Kept in its own table so recording a sync does not itself bump `version`.
CREATE TABLE IF NOT EXISTS firebase_sync (
  registration_id uuid PRIMARY KEY REFERENCES registrations (id),
  synced_version  bigint      NOT NULL DEFAULT 0,
  synced_at       timestamptz,
  attempts        integer     NOT NULL DEFAULT 0,
  last_error      text,
  last_attempt_at timestamptz
);

-- One row per person per ACTIVE registration (pending-and-held, or confirmed).
-- Rows are deleted when a hold expires or is cancelled.
CREATE TABLE IF NOT EXISTS participants (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  registration_id uuid    NOT NULL REFERENCES registrations (id) ON DELETE CASCADE,
  event_id        text    NOT NULL,
  is_leader       boolean NOT NULL DEFAULT false,
  name            text    NOT NULL,
  roll_no         text    NOT NULL,   -- normalised by the app: upper-case, no spaces
  email           text,
  phone           text,
  year            text,
  department      text,
  college         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT participants_event_roll_unique UNIQUE (event_id, roll_no)
);

CREATE INDEX IF NOT EXISTS participants_registration_idx ON participants (registration_id);

-- Exactly one leader per registration
CREATE UNIQUE INDEX IF NOT EXISTS participants_one_leader_idx
  ON participants (registration_id) WHERE is_leader;


-- -----------------------------------------------------------------------------
-- Per-event lock helper (transaction-scoped; released automatically on commit)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_lock_event(p_event_id text) RETURNS void
LANGUAGE sql AS $$
  SELECT pg_advisory_xact_lock(hashtextextended('udgam-event:' || p_event_id, 0));
$$;


-- -----------------------------------------------------------------------------
-- Release spots held by unpaid registrations whose hold has run out.
-- Caller must already hold the event lock.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_release_expired(p_event_id text) RETURNS void
LANGUAGE sql AS $$
  WITH expired AS (
    UPDATE registrations
       SET status = 'expired', updated_at = now()
     WHERE event_id = p_event_id
       AND status = 'pending'
       AND expires_at < now()
    RETURNING id
  )
  DELETE FROM participants WHERE registration_id IN (SELECT id FROM expired);
$$;


-- -----------------------------------------------------------------------------
-- Insert participant rows for a registration from its members snapshot.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_insert_participants(p_registration_id uuid, p_event_id text, p_members jsonb)
RETURNS void
LANGUAGE sql AS $$
  INSERT INTO participants (registration_id, event_id, is_leader, name, roll_no, email, phone, year, department, college)
  SELECT p_registration_id,
         p_event_id,
         COALESCE((m ->> 'is_leader')::boolean, false),
         m ->> 'name',
         m ->> 'roll_no',
         m ->> 'email',
         m ->> 'phone',
         m ->> 'year',
         m ->> 'department',
         m ->> 'college'
    FROM jsonb_array_elements(p_members) AS m;
$$;


-- -----------------------------------------------------------------------------
-- Roll numbers from a members snapshot that already hold a spot in the event.
-- Returns [{ "roll_no": "...", "pending": true|false }]
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_find_conflicts(p_event_id text, p_members jsonb) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object('roll_no', p.roll_no, 'pending', r.status = 'pending')
                     ORDER BY p.roll_no),
           '[]'::jsonb)
    FROM participants p
    JOIN registrations r ON r.id = p.registration_id
   WHERE p.event_id = p_event_id
     AND p.roll_no IN (SELECT m ->> 'roll_no' FROM jsonb_array_elements(p_members) AS m);
$$;


-- -----------------------------------------------------------------------------
-- Register a team atomically.
--   Returns one row: (registration_id, status, conflicts)
--   status = 'confirmed' (free event) | 'pending' (awaiting payment) | 'conflict'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_register_team(
  p_event_id       text,
  p_team_name      text,
  p_amount_paise   integer,
  p_members        jsonb,
  p_leader_roll_no text,
  p_leader_email   text,
  p_leader_phone   text,
  p_hold_minutes   integer
)
RETURNS TABLE (registration_id uuid, status text, conflicts jsonb)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  v_id        uuid;
  v_status    text;
  v_conflicts jsonb;
BEGIN
  PERFORM udgam_lock_event(p_event_id);
  PERFORM udgam_release_expired(p_event_id);

  v_conflicts := udgam_find_conflicts(p_event_id, p_members);
  IF jsonb_array_length(v_conflicts) > 0 THEN
    RETURN QUERY SELECT NULL::uuid, 'conflict'::text, v_conflicts;
    RETURN;
  END IF;

  v_status := CASE WHEN p_amount_paise = 0 THEN 'confirmed' ELSE 'pending' END;

  INSERT INTO registrations (event_id, team_name, status, amount_paise, members,
                             leader_roll_no, leader_email, leader_phone,
                             expires_at, confirmed_at)
  VALUES (p_event_id, p_team_name, v_status, p_amount_paise, p_members,
          p_leader_roll_no, p_leader_email, p_leader_phone,
          CASE WHEN v_status = 'pending' THEN now() + make_interval(mins => p_hold_minutes) END,
          CASE WHEN v_status = 'confirmed' THEN now() END)
  RETURNING id INTO v_id;

  PERFORM udgam_insert_participants(v_id, p_event_id, p_members);

  RETURN QUERY SELECT v_id, v_status, '[]'::jsonb;
END;
$$;


-- -----------------------------------------------------------------------------
-- Mark a registration paid. Idempotent: safe to call from both the browser
-- callback and the Razorpay webhook, in any order, any number of times.
--   p_amount_paise: amount actually paid if known (webhook), else NULL.
--   Returns one row: (registration_id, status)
--   status = 'confirmed' | 'refund_required' | 'not_found' | 'cancelled'
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_confirm_payment(
  p_order_id     text,
  p_payment_id   text,
  p_amount_paise integer
)
RETURNS TABLE (registration_id uuid, status text)
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  v_event_id text;
  r          registrations%ROWTYPE;
BEGIN
  SELECT event_id INTO v_event_id FROM registrations WHERE razorpay_order_id = p_order_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'not_found'::text;
    RETURN;
  END IF;

  -- Same lock order as udgam_register_team (event lock first, then row) to avoid deadlocks
  PERFORM udgam_lock_event(v_event_id);
  SELECT * INTO r FROM registrations WHERE razorpay_order_id = p_order_id FOR UPDATE;

  IF r.status IN ('confirmed', 'refund_required') THEN
    RETURN QUERY SELECT r.id, r.status;   -- already processed
    RETURN;
  END IF;

  -- Paid the wrong amount (should be impossible for a Razorpay order, but never trust it)
  IF p_amount_paise IS NOT NULL AND p_amount_paise <> r.amount_paise THEN
    DELETE FROM participants WHERE participants.registration_id = r.id;
    UPDATE registrations
       SET status = 'refund_required', razorpay_payment_id = p_payment_id,
           expires_at = NULL, updated_at = now()
     WHERE id = r.id;
    RETURN QUERY SELECT r.id, 'refund_required'::text;
    RETURN;
  END IF;

  IF r.status = 'pending' THEN
    -- spots are still held (even if expires_at just passed, nobody released them yet)
    UPDATE registrations
       SET status = 'confirmed', razorpay_payment_id = p_payment_id,
           confirmed_at = now(), expires_at = NULL, updated_at = now()
     WHERE id = r.id;
    RETURN QUERY SELECT r.id, 'confirmed'::text;
    RETURN;
  END IF;

  -- 'expired' or 'cancelled' but money arrived anyway: try to take the spots back
  PERFORM udgam_release_expired(r.event_id);
  IF jsonb_array_length(udgam_find_conflicts(r.event_id, r.members)) > 0 THEN
    UPDATE registrations
       SET status = 'refund_required', razorpay_payment_id = p_payment_id,
           expires_at = NULL, updated_at = now()
     WHERE id = r.id;
    RETURN QUERY SELECT r.id, 'refund_required'::text;
    RETURN;
  END IF;

  PERFORM udgam_insert_participants(r.id, r.event_id, r.members);
  UPDATE registrations
     SET status = 'confirmed', razorpay_payment_id = p_payment_id,
         confirmed_at = now(), expires_at = NULL, updated_at = now()
   WHERE id = r.id;
  RETURN QUERY SELECT r.id, 'confirmed'::text;
END;
$$;


-- -----------------------------------------------------------------------------
-- Leader cancels an unpaid registration (to fix team details and retry).
--   Requires the registration id AND the leader's roll number.
--   Returns: 'cancelled' | 'not_found' | <current status if not pending>
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION udgam_cancel_pending(p_registration_id uuid, p_leader_roll_no text)
RETURNS text
LANGUAGE plpgsql AS $$
#variable_conflict use_column
DECLARE
  v_event_id text;
  r          registrations%ROWTYPE;
BEGIN
  SELECT event_id INTO v_event_id
    FROM registrations WHERE id = p_registration_id AND leader_roll_no = p_leader_roll_no;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  PERFORM udgam_lock_event(v_event_id);
  SELECT * INTO r FROM registrations WHERE id = p_registration_id FOR UPDATE;

  IF r.status <> 'pending' THEN
    RETURN r.status;
  END IF;

  DELETE FROM participants WHERE participants.registration_id = r.id;
  UPDATE registrations SET status = 'cancelled', expires_at = NULL, updated_at = now() WHERE id = r.id;
  RETURN 'cancelled';
END;
$$;


-- -----------------------------------------------------------------------------
-- Firebase backup bookkeeping
-- -----------------------------------------------------------------------------

-- Record that `p_version` of a registration is in Firestore (never moves backwards).
CREATE OR REPLACE FUNCTION udgam_mark_synced(p_registration_id uuid, p_version bigint) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO firebase_sync (registration_id, synced_version, synced_at, attempts, last_error, last_attempt_at)
  VALUES (p_registration_id, p_version, now(), 1, NULL, now())
  ON CONFLICT (registration_id) DO UPDATE
    SET synced_version  = GREATEST(firebase_sync.synced_version, EXCLUDED.synced_version),
        synced_at       = now(),
        attempts        = firebase_sync.attempts + 1,
        last_error      = NULL,
        last_attempt_at = now();
$$;

-- Record a failed backup attempt (keeps the registration in the "not yet backed up" list).
CREATE OR REPLACE FUNCTION udgam_mark_sync_failed(p_registration_id uuid, p_error text) RETURNS void
LANGUAGE sql AS $$
  INSERT INTO firebase_sync (registration_id, synced_version, attempts, last_error, last_attempt_at)
  VALUES (p_registration_id, 0, 1, left(p_error, 500), now())
  ON CONFLICT (registration_id) DO UPDATE
    SET attempts        = firebase_sync.attempts + 1,
        last_error      = left(p_error, 500),
        last_attempt_at = now();
$$;

-- Registrations whose latest version is not yet in Firebase, oldest change first.
CREATE OR REPLACE VIEW udgam_unsynced AS
  SELECT r.id, r.version, r.updated_at, s.synced_version, s.attempts, s.last_error, s.last_attempt_at
    FROM registrations r
    LEFT JOIN firebase_sync s ON s.registration_id = r.id
   WHERE COALESCE(s.synced_version, 0) < r.version;


-- -----------------------------------------------------------------------------
-- Admin panel login throttling (brute-force protection)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  ip           text        NOT NULL,
  succeeded    boolean     NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_login_attempts_time_idx ON admin_login_attempts (attempted_at);
CREATE INDEX IF NOT EXISTS admin_login_attempts_ip_time_idx ON admin_login_attempts (ip, attempted_at);

-- true if this IP (or everyone combined) has failed too often in the last 15 minutes
CREATE OR REPLACE FUNCTION udgam_admin_login_blocked(p_ip text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT (SELECT count(*) FROM admin_login_attempts
           WHERE ip = p_ip AND NOT succeeded AND attempted_at > now() - interval '15 minutes') >= 5
      OR (SELECT count(*) FROM admin_login_attempts
           WHERE NOT succeeded AND attempted_at > now() - interval '15 minutes') >= 50;
$$;
