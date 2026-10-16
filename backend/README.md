# Udgam 2K26 — backend API

Node.js + Express server for event registration, Razorpay payments, the Firebase backup copy and
the admin panel. The website (`../frontend`) calls it over HTTPS.

```
backend/
├── db/
│   ├── schema.sql          Postgres schema + all registration rules (SQL functions)
│   └── firestore.rules     Firebase security rules (deny all browser access)
├── src/
│   ├── index.ts            starts the server + keep-alive ping
│   ├── app.ts              Express app: security headers, CORS, routes, error handling
│   ├── config/env.ts       environment variables
│   ├── data/events.ts      fee + team size per event (what the server charges/enforces)
│   ├── validation/         registration input rules
│   ├── db/client.ts        Neon Postgres client
│   ├── middleware/auth.ts  admin token checks
│   ├── routes/             registrations, razorpay webhook, admin
│   └── services/           registrations, razorpay, firestore, backup, adminAuth, adminData
├── test/                   54 tests (real Postgres via PGlite, HTTP-level API tests)
├── scripts/apply-schema.mjs
└── render.yaml             Render blueprint (Blueprint Path: backend/render.yaml)
```

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | liveness (no DB) — Render health check + keep-alive |
| GET | `/health/db` | database reachable? |
| POST | `/api/registrations` | validate team, hold spots, create Razorpay order (free events confirm immediately) |
| POST | `/api/registrations/verify-payment` | Razorpay Checkout success callback |
| POST | `/api/registrations/cancel` | leader releases an unpaid registration |
| GET | `/api/registrations/:id/status` | status only, no personal data |
| POST | `/api/razorpay/webhook` | Razorpay → server payment confirmation |
| POST | `/api/admin/login` | returns an 8-hour admin token |
| GET | `/api/admin/session`, `/overview`, `/events/:id/registrations?status=`, `/search?q=` | admin data (Bearer token) |
| POST | `/api/admin/backup-sync` | copy un-backed-up registrations to Firebase (admin token or `BACKUP_SYNC_TOKEN`) |

## Rules enforced

- Every registration has one **leader** (name, roll no, email, mobile, year, department, college)
  plus members (name, roll no).
- Team size must be within the event's `teamSize` (leader included) — no more, no fewer.
- All roll numbers in a team must be different (compared ignoring spaces and case).
- A roll number can be in **only one team per event**, confirmed or still paying. The database
  enforces this (`UNIQUE (event_id, roll_no)` + a per-event lock), so two teams submitting at the
  same moment can't both get the same player.
- Fees come only from `src/data/events.ts`; the browser never sends an amount.
  `test/events-sync.test.ts` fails if they differ from what the website shows
  (`frontend/src/features/events/data/eventDetails.ts`) — change both together.
- A paid registration holds its spots for **20 minutes**, then releases them. A payment that
  arrives after the spots were taken is marked `refund_required`.
- Payments are confirmed only after checking the Razorpay signature **and** asking Razorpay that
  the payment was captured for that exact order and amount.
- Rate limits: 20 registration attempts per IP per 10 minutes; admin login 20 per 15 minutes per
  IP, plus a 5-failure lockout per IP stored in the database.

## Two copies of the data (Neon + Firebase)

- **Neon is the source of truth.** It enforces every rule above; a registration exists only once
  Neon has accepted it. If Neon is unreachable the student sees an error and nothing is half-saved.
- **Firebase (Firestore collection `registrations`) holds a backup copy** of every registration
  (team, members, leader contact, status, payment IDs; document ID = registration ID).
- Every change bumps `registrations.version`; a registration counts as backed up only when that
  exact version is in Firestore, and an older copy can never overwrite a newer one.
- If Firebase is down, registration still works; the change waits in the `udgam_unsynced` view.
- **Automatic backup:** the server itself copies everything not yet backed up **every 5 minutes**
  (`src/jobs/backupScheduler.ts`; first run 30 s after start; `BACKUP_INTERVAL_MINUTES` changes the
  interval, `0` disables it). Runs never overlap and a failed run is retried next time. The Razorpay
  webhook and `POST /api/admin/backup-sync` (admin "Back up now" button) trigger extra syncs.
- Rows in `registrations` can't be deleted (a trigger blocks DELETE).

## Run locally

```sh
cd backend
cp .env.example .env      # fill in the values
npm install
npm run db:schema         # creates/updates the tables in DATABASE_URL (safe to re-run)
npm run dev               # http://localhost:4000
npm test
```

The website's dev server (`cd ../frontend && npm run dev`, port 8080) calls
`http://localhost:4000` by default; keep `http://localhost:8080` in `FRONTEND_ORIGINS`.

## Deploy on Render

1. Render Dashboard → **New → Blueprint** → choose the repo and set **Blueprint Path** to
   `backend/render.yaml`. It creates the `udgam-api` web service from `backend/`.
   (Or **New → Web Service**: Root Directory `backend`, Build `npm ci && npm run build`,
   Start `npm start`, Health Check Path `/health`.)
2. Fill in the environment variables (see `.env.example`). `FRONTEND_ORIGINS` = your website's
   URL(s), e.g. `https://udgam.example.com`.
3. Run the schema once: locally with the production `DATABASE_URL`, `npm run db:schema`
   (or `psql "$DATABASE_URL" -f db/schema.sql`).
4. In the website's settings set `VITE_API_URL=https://udgam-api.onrender.com` (your service URL)
   and redeploy the website.
5. **Razorpay webhook**: Dashboard → Webhooks → `https://udgam-api.onrender.com/api/razorpay/webhook`,
   with your `RAZORPAY_WEBHOOK_SECRET`, events `payment.authorized`, `payment.captured`, `order.paid`.
6. **Firebase**: Project settings → Service accounts → *Generate new private key* → put
   `project_id`, `client_email`, `private_key` into the `FIREBASE_*` variables. Create Firestore
   (Native mode) and publish `db/firestore.rules`.
7. **Optional cron** (extra keep-alive): backups already run automatically every 5 minutes inside
   the server. As a second safety net you can add a [cron-job.org](https://cron-job.org) job every
   5 minutes: `POST https://udgam-api.onrender.com/api/admin/backup-sync` with header
   `Authorization: Bearer <BACKUP_SYNC_TOKEN>` (it also wakes the server if it ever fell asleep).
8. When ready: `REGISTRATIONS_OPEN=true`, and update the "do not register yet" lines in
   `frontend/src/features/events/components/NoticeTicker.tsx`.

### Staying awake on Render's free plan

Free services sleep after 15 minutes without incoming traffic, and the first request after that
takes ~30–60 s (a student would see a slow or failed registration, and webhooks would be delayed).
Two things keep it awake around the clock:

- **Self ping** — while running, the server calls its own public URL (`RENDER_EXTERNAL_URL`, set by
  Render automatically) `/health` every **10 minutes**. Logged as `[keep-alive] pinging …`.
- **Optional external cron** — the backup-sync job above also counts as traffic, and wakes the
  service again if it ever restarted and fell asleep.

A free service running all month uses ~730 of Render's 750 free instance hours, so keep only this
one free service on the account. For the live registration period a paid instance (no sleeping)
is still the safest choice.

## Admin panel — website `/admin`

Log in with `ADMIN_USERNAME` / `ADMIN_PASSWORD` (environment variables only — never in code).

- **Dashboard**: confirmed teams, participants, unique students, revenue, teams paying right now,
  refunds to process, Firebase backup health ("Back up now"), per-event table, latest registrations.
- **Event page**: every team with members, leader contacts, payment ID and timestamps; filter by
  status; search. **Print sheet** (A4 attendance sheet with signature column, optional contacts)
  and **Download CSV** (one row per participant).
- **Search** across all events by roll number, name, team, email, phone, payment or registration ID.

The login returns a signed token valid for 8 hours, kept in the browser tab's sessionStorage and
sent as an `Authorization` header. Changing `ADMIN_PASSWORD` or `ADMIN_SESSION_SECRET` logs everyone
out. The panel is read-only.

## Useful queries

```sql
-- Confirmed teams for an event, with members
SELECT r.team_name, p.is_leader, p.name, p.roll_no, p.email, p.phone, p.year, p.department, p.college
  FROM registrations r JOIN participants p ON p.registration_id = r.id
 WHERE r.event_id = 'rangoli' AND r.status = 'confirmed'
 ORDER BY r.confirmed_at, p.is_leader DESC;

-- Payments that must be refunded manually (Razorpay Dashboard -> Payments -> Refund)
SELECT id, event_id, leader_roll_no, leader_email, leader_phone, razorpay_payment_id, amount_paise / 100 AS rupees
  FROM registrations WHERE status = 'refund_required';

-- Backup health: registrations whose latest version is NOT yet in Firebase (should be empty)
SELECT * FROM udgam_unsynced ORDER BY updated_at;
```
