import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminEventRegistrations,
  getAdminOverview,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  runAdminBackupSync,
  searchAdminRegistrations,
} from "./api";
import { downloadCsv, registrationsToCsv } from "./csv";
import type {
  AdminEventStats,
  AdminOverview,
  AdminRegistration,
  AdminResult,
  RegistrationStatus,
} from "./types";

type View = { kind: "overview" } | { kind: "event"; eventId: string } | { kind: "search" };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;
const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—";

const STATUS_LABEL: Record<RegistrationStatus, string> = {
  confirmed: "Confirmed",
  pending: "Payment pending",
  expired: "Expired (unpaid)",
  cancelled: "Cancelled",
  refund_required: "Refund required",
};

const sizeText = (s: { min: number; max: number }) =>
  s.max === 1 ? "Individual" : s.min === s.max ? `${s.min}` : `${s.min}–${s.max}`;

export default function AdminPage() {
  const [user, setUser] = useState<string | null | undefined>(undefined);
  // stable identity: Dashboard's data loaders depend on it
  const handleLoggedOut = useCallback(() => setUser(null), []);

  useEffect(() => {
    getAdminSession()
      .then((s) => setUser(s.username))
      .catch(() => setUser(null));
  }, []);

  if (user === undefined) return <div className="adm-center">Loading…</div>;
  if (!user) return <Login onLoggedIn={setUser} />;
  return <Dashboard user={user} onLoggedOut={handleLoggedOut} />;
}

// ---------------------------------------------------------------- login

function Login({ onLoggedIn }: { onLoggedIn: (u: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const res = await loginAdmin({ data: { username, password } }).catch(() => null);
    setBusy(false);
    if (res?.ok) onLoggedIn(res.username);
    else setError(res?.message ?? "Couldn't reach the server.");
  };

  return (
    <div className="adm-center">
      <form className="adm-login" onSubmit={submit}>
        <p className="adm-eyebrow">Udgam 2K26</p>
        <h1>Admin panel</h1>
        <label>
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            required
          />
        </label>
        <label>
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error && (
          <p className="adm-error" role="alert">
            {error}
          </p>
        )}
        <button className="adm-btn adm-btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------- shell

function Dashboard({ user, onLoggedOut }: { user: string; onLoggedOut: () => void }) {
  const [view, setView] = useState<View>({ kind: "overview" });
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Unwraps an admin API result; on an expired session it returns to the login screen. */
  const unwrap = useCallback(
    <T,>(res: AdminResult<T> | null): T | null => {
      if (!res) {
        setError("Couldn't reach the server.");
        return null;
      }
      if (!res.ok) {
        if (res.error === "unauthorized") onLoggedOut();
        else setError(res.message);
        return null;
      }
      setError(null);
      return res.data;
    },
    [onLoggedOut],
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);
    const data = unwrap(await getAdminOverview().catch(() => null));
    if (data) setOverview(data);
    setLoading(false);
  }, [unwrap]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  const logout = async () => {
    await logoutAdmin().catch(() => undefined);
    onLoggedOut();
  };

  const eventStats =
    view.kind === "event" ? overview?.events.find((e) => e.eventId === view.eventId) : undefined;

  return (
    <div className="adm-shell">
      <header className="adm-top no-print">
        <div className="adm-brand">
          Udgam 2K26 <span>Admin</span>
        </div>
        <nav className="adm-nav">
          <button
            className={view.kind === "overview" ? "is-active" : ""}
            onClick={() => setView({ kind: "overview" })}
          >
            Dashboard
          </button>
          <button
            className={view.kind === "search" ? "is-active" : ""}
            onClick={() => setView({ kind: "search" })}
          >
            Search
          </button>
        </nav>
        <div className="adm-user">
          <span>{user}</span>
          <button className="adm-btn" onClick={logout}>
            Log out
          </button>
        </div>
      </header>

      <main className="adm-main">
        {error && (
          <p className="adm-error no-print" role="alert">
            {error}
          </p>
        )}
        {view.kind === "overview" &&
          (overview ? (
            <Overview
              data={overview}
              loading={loading}
              onRefresh={loadOverview}
              onOpenEvent={(eventId) => setView({ kind: "event", eventId })}
              unwrap={unwrap}
            />
          ) : (
            <p className="adm-muted">{loading ? "Loading dashboard…" : ""}</p>
          ))}
        {view.kind === "event" && (
          <EventView
            eventId={view.eventId}
            stats={eventStats}
            onBack={() => {
              setView({ kind: "overview" });
              void loadOverview();
            }}
            unwrap={unwrap}
          />
        )}
        {view.kind === "search" && <SearchView unwrap={unwrap} />}
      </main>
    </div>
  );
}

type Unwrap = <T>(res: AdminResult<T> | null) => T | null;

// ---------------------------------------------------------------- overview

function Overview({
  data,
  loading,
  onRefresh,
  onOpenEvent,
  unwrap,
}: {
  data: AdminOverview;
  loading: boolean;
  onRefresh: () => void;
  onOpenEvent: (id: string) => void;
  unwrap: Unwrap;
}) {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [sort, setSort] = useState<"name" | "teams" | "revenue">("teams");

  const events = useMemo(() => {
    const list = [...data.events];
    if (sort === "name") list.sort((a, b) => a.eventName.localeCompare(b.eventName));
    if (sort === "teams")
      list.sort(
        (a, b) => b.confirmedTeams - a.confirmedTeams || a.eventName.localeCompare(b.eventName),
      );
    if (sort === "revenue") list.sort((a, b) => b.revenuePaise - a.revenuePaise);
    return list;
  }, [data.events, sort]);

  const sync = async () => {
    setSyncing(true);
    const res = unwrap(await runAdminBackupSync().catch(() => null));
    setSyncing(false);
    if (res) {
      setSyncMsg(
        res.configured
          ? `Backed up ${res.synced}${res.failed ? `, ${res.failed} failed` : ""}. ${res.remaining} left.`
          : "Firebase is not configured on the server.",
      );
      onRefresh();
    }
  };

  const t = data.totals;
  return (
    <>
      <div className="adm-head">
        <h1>Dashboard</h1>
        <div className="adm-actions">
          <span className="adm-muted">Updated {when(data.generatedAt)}</span>
          <button className="adm-btn" onClick={onRefresh} disabled={loading}>
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      <section className="adm-cards">
        <Stat label="Confirmed teams" value={t.confirmedTeams} />
        <Stat label="Participants (entries)" value={t.confirmedParticipants} />
        <Stat label="Unique students" value={t.uniqueParticipants} />
        <Stat label="Revenue collected" value={rupees(t.revenuePaise)} />
        <Stat label="Paying right now" value={t.pendingTeams} />
        <Stat label="Refunds to process" value={t.refunds} tone={t.refunds ? "bad" : undefined} />
        <div
          className={`adm-card ${data.backup.configured && data.backup.unsynced === 0 ? "" : "is-warn"}`}
        >
          <span className="adm-card-label">Firebase backup</span>
          <strong className="adm-card-value">
            {!data.backup.configured
              ? "Not configured"
              : data.backup.unsynced === 0
                ? "Up to date"
                : `${data.backup.unsynced} pending`}
          </strong>
          <button className="adm-btn adm-btn-small" onClick={sync} disabled={syncing}>
            {syncing ? "Backing up…" : "Back up now"}
          </button>
          {syncMsg && <span className="adm-muted">{syncMsg}</span>}
        </div>
      </section>

      <section className="adm-panel">
        <div className="adm-panel-head">
          <h2>Registrations by event</h2>
          <label className="adm-inline">
            Sort
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option value="teams">Most teams</option>
              <option value="revenue">Most revenue</option>
              <option value="name">Name</option>
            </select>
          </label>
        </div>
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Event</th>
                <th>Team size</th>
                <th>Fee</th>
                <th className="num">Teams</th>
                <th className="num">Participants</th>
                <th className="num">Paying now</th>
                <th className="num">Revenue</th>
                <th>Last registration</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <EventRow key={e.eventId} e={e} onOpen={() => onOpenEvent(e.eventId)} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {data.refunds.length > 0 && (
        <section className="adm-panel is-bad">
          <h2>Refunds to process ({data.refunds.length})</h2>
          <p className="adm-muted">
            These teams paid after their hold expired and a member's spot was taken. Refund them in
            the Razorpay Dashboard → Payments using the payment ID.
          </p>
          <RegistrationList rows={data.refunds} showEvent />
        </section>
      )}

      <section className="adm-panel">
        <h2>Latest confirmed registrations</h2>
        {data.recent.length ? (
          <RegistrationList rows={data.recent} showEvent />
        ) : (
          <p className="adm-muted">No registrations yet.</p>
        )}
      </section>
    </>
  );
}

function EventRow({ e, onOpen }: { e: AdminEventStats; onOpen: () => void }) {
  return (
    <tr className="is-clickable" onClick={onOpen}>
      <td>
        <button className="adm-link" onClick={onOpen}>
          {e.eventName}
        </button>
        {e.tier === "major" && <span className="adm-tag">Major</span>}
      </td>
      <td>{sizeText(e.teamSize)}</td>
      <td>
        {e.fee === null
          ? "TBA"
          : e.fee === 0
            ? "Free"
            : `₹${e.fee}${e.feeUnit ? `/${e.feeUnit}` : ""}`}
      </td>
      <td className="num">{e.confirmedTeams}</td>
      <td className="num">{e.confirmedParticipants}</td>
      <td className="num">{e.pendingTeams || ""}</td>
      <td className="num">{e.revenuePaise ? rupees(e.revenuePaise) : "—"}</td>
      <td>{when(e.lastConfirmedAt)}</td>
    </tr>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "bad" | undefined;
}) {
  return (
    <div className={`adm-card ${tone === "bad" ? "is-bad" : ""}`}>
      <span className="adm-card-label">{label}</span>
      <strong className="adm-card-value">{value}</strong>
    </div>
  );
}

// ---------------------------------------------------------------- event view

function EventView({
  eventId,
  stats,
  onBack,
  unwrap,
}: {
  eventId: string;
  stats: AdminEventStats | undefined;
  onBack: () => void;
  unwrap: Unwrap;
}) {
  const [status, setStatus] = useState<RegistrationStatus | "all">("confirmed");
  const [rows, setRows] = useState<AdminRegistration[] | null>(null);
  const [filter, setFilter] = useState("");
  const [withEmail, setWithEmail] = useState(false);
  const [loading, setLoading] = useState(false);
  const latestLoad = useRef(0);

  const load = useCallback(async () => {
    const request = ++latestLoad.current;
    setLoading(true);
    const res = await getAdminEventRegistrations({ data: { eventId, status } }).catch(() => null);
    // a slow answer for a previous status must not replace the list (or the CSV) of the current one
    if (request !== latestLoad.current) return;
    const data = unwrap(res);
    if (data) setRows(data);
    setLoading(false);
  }, [eventId, status, unwrap]);

  useEffect(() => {
    setRows(null);
    void load();
  }, [load]);

  const shown = useMemo(() => {
    if (!rows) return [];
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        (r.teamName ?? "").toLowerCase().includes(q) ||
        r.leaderPhone.includes(q) ||
        r.leaderEmail.toLowerCase().includes(q) ||
        r.members.some(
          (m) => m.name.toLowerCase().includes(q) || m.roll_no.toLowerCase().includes(q),
        ),
    );
  }, [rows, filter]);

  const name = stats?.eventName ?? eventId;
  const participants = shown.reduce((n, r) => n + r.members.length, 0);
  const isTeamEvent = (stats?.teamSize.max ?? 1) > 1;

  const exportCsv = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`udgam-${eventId}-${status}-${stamp}.csv`, registrationsToCsv(shown));
  };

  return (
    <>
      <div className="adm-head no-print">
        <div>
          <button className="adm-link" onClick={onBack}>
            ← All events
          </button>
          <h1>{name}</h1>
          {stats && (
            <p className="adm-muted">
              Team size {sizeText(stats.teamSize)} ·{" "}
              {stats.fee === null
                ? "Fee TBA"
                : stats.fee === 0
                  ? "Free"
                  : `₹${stats.fee} per ${stats.feeUnit ?? "team"}`}{" "}
              · {stats.confirmedTeams} confirmed {isTeamEvent ? "teams" : "entries"},{" "}
              {stats.confirmedParticipants} participants · {rupees(stats.revenuePaise)}
            </p>
          )}
        </div>
        <div className="adm-actions">
          <button className="adm-btn" onClick={load} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button className="adm-btn" onClick={exportCsv} disabled={!shown.length}>
            Download CSV
          </button>
          <button
            className="adm-btn adm-btn-primary"
            onClick={() => window.print()}
            disabled={!shown.length}
          >
            Print sheet
          </button>
        </div>
      </div>

      <div className="adm-toolbar no-print">
        <label className="adm-inline">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Payment pending</option>
            <option value="refund_required">Refund required</option>
            <option value="expired">Expired (unpaid)</option>
            <option value="cancelled">Cancelled</option>
            <option value="all">All</option>
          </select>
        </label>
        <input
          className="adm-search"
          placeholder="Filter by team, name, roll no, phone…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <label className="adm-inline">
          <input
            type="checkbox"
            checked={withEmail}
            onChange={(e) => setWithEmail(e.target.checked)}
          />
          Email on printed sheet
        </label>
        <span className="adm-muted">
          {shown.length} {isTeamEvent ? "teams" : "entries"} · {participants} participants
        </span>
      </div>

      <div className="no-print">
        {!rows ? (
          <p className="adm-muted">Loading…</p>
        ) : shown.length ? (
          <RegistrationList rows={shown} />
        ) : (
          <p className="adm-muted">No registrations match.</p>
        )}
      </div>

      <PrintSheet
        eventName={name}
        status={status}
        rows={shown}
        withEmail={withEmail}
        isTeamEvent={isTeamEvent}
      />
    </>
  );
}

/** Hidden on screen; the only thing visible when printing. */
function PrintSheet({
  eventName,
  status,
  rows,
  withEmail,
  isTeamEvent,
}: {
  eventName: string;
  status: string;
  rows: AdminRegistration[];
  withEmail: boolean;
  isTeamEvent: boolean;
}) {
  let serial = 0;
  return (
    <section className="adm-print">
      <header className="adm-print-head">
        <div>
          <p>Udgam 2K26 · NIT Sikkim</p>
          <h1>{eventName} — participant sheet</h1>
        </div>
        <p>
          {status === "confirmed" ? "Confirmed registrations" : `Status: ${status}`} · {rows.length}{" "}
          {isTeamEvent ? "teams" : "entries"} · {rows.reduce((n, r) => n + r.members.length, 0)}{" "}
          participants
          <br />
          Printed {when(new Date().toISOString())}
        </p>
      </header>
      <table>
        <thead>
          <tr>
            <th>#</th>
            {isTeamEvent && <th>Team</th>}
            <th>Name</th>
            <th>Roll no</th>
            {isTeamEvent && <th>Role</th>}
            <th>Mobile</th>
            {withEmail && <th>Email</th>}
            <th className="sig">Signature</th>
          </tr>
        </thead>
        {rows.map((r, ti) => (
          <tbody key={r.id}>
            {r.members.map((m, mi) => {
              serial++;
              return (
                <tr key={m.roll_no}>
                  <td>{serial}</td>
                  {isTeamEvent && mi === 0 && (
                    <td rowSpan={r.members.length} className="team">
                      {ti + 1}. {r.teamName || "—"}
                    </td>
                  )}
                  <td>{m.name}</td>
                  <td>{m.roll_no}</td>
                  {isTeamEvent && <td>{m.is_leader ? "Leader" : "Member"}</td>}
                  <td className="mobile">{m.phone ?? (m.is_leader ? r.leaderPhone : "")}</td>
                  {withEmail && <td>{m.email ?? (m.is_leader ? r.leaderEmail : "")}</td>}
                  <td className="sig" />
                </tr>
              );
            })}
          </tbody>
        ))}
      </table>
    </section>
  );
}

// ---------------------------------------------------------------- search

function SearchView({ unwrap }: { unwrap: Unwrap }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<AdminRegistration[] | null>(null);
  const [busy, setBusy] = useState(false);

  const search = async (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim().length < 2) return;
    setBusy(true);
    const data = unwrap(await searchAdminRegistrations({ data: { q } }).catch(() => null));
    if (data) setRows(data);
    setBusy(false);
  };

  return (
    <>
      <div className="adm-head">
        <h1>Search registrations</h1>
      </div>
      <form className="adm-toolbar" onSubmit={search}>
        <input
          className="adm-search"
          placeholder="Roll number, name, team, email, phone, payment ID or registration ID"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <button className="adm-btn adm-btn-primary" disabled={busy || q.trim().length < 2}>
          {busy ? "Searching…" : "Search"}
        </button>
      </form>
      <p className="adm-muted">
        Searches every event and every status (including expired and cancelled).
      </p>
      {rows &&
        (rows.length ? (
          <>
            <p className="adm-muted">
              {rows.length} result{rows.length === 1 ? "" : "s"}
              {rows.length === 100 ? " (showing first 100)" : ""}
            </p>
            <RegistrationList rows={rows} showEvent />
          </>
        ) : (
          <p className="adm-muted">Nothing found.</p>
        ))}
    </>
  );
}

// ---------------------------------------------------------------- registration cards

function RegistrationList({
  rows,
  showEvent = false,
}: {
  rows: AdminRegistration[];
  showEvent?: boolean;
}) {
  return (
    <div className="adm-regs">
      {rows.map((r) => (
        <RegistrationCard key={r.id} r={r} showEvent={showEvent} />
      ))}
    </div>
  );
}

function RegistrationCard({ r, showEvent }: { r: AdminRegistration; showEvent: boolean }) {
  const [open, setOpen] = useState(false);
  const leader = r.members.find((m) => m.is_leader) ?? r.members[0];
  const copy = (text: string) => void navigator.clipboard?.writeText(text).catch(() => undefined);

  return (
    <article className={`adm-reg is-${r.status}`}>
      <button className="adm-reg-head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span className="adm-reg-title">
          {showEvent && <span className="adm-tag">{r.eventName}</span>}
          {r.teamName || leader?.name || "—"}
        </span>
        <span className="adm-reg-meta">
          {r.members.length} {r.members.length === 1 ? "person" : "people"} ·{" "}
          {rupees(r.amountPaise)} ·{" "}
          <span className={`adm-status is-${r.status}`}>{STATUS_LABEL[r.status]}</span>
        </span>
        <span className="adm-reg-chev">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="adm-reg-body">
          <dl className="adm-dl">
            <div>
              <dt>Leader</dt>
              <dd>
                {leader?.name} ({r.leaderRollNo})
              </dd>
            </div>
            <div>
              <dt>Phone</dt>
              <dd>
                <a href={`tel:${r.leaderPhone}`}>{r.leaderPhone}</a>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>
                <a href={`mailto:${r.leaderEmail}`}>{r.leaderEmail}</a>
              </dd>
            </div>
            {leader?.year && (
              <div>
                <dt>Year / dept</dt>
                <dd>
                  {leader.year} · {leader.department}
                </dd>
              </div>
            )}
            {leader?.college && (
              <div>
                <dt>College</dt>
                <dd>{leader.college}</dd>
              </div>
            )}
            <div>
              <dt>Registered</dt>
              <dd>{when(r.createdAt)}</dd>
            </div>
            <div>
              <dt>Confirmed</dt>
              <dd>{when(r.confirmedAt)}</dd>
            </div>
            <div>
              <dt>Payment ID</dt>
              <dd>
                {r.razorpayPaymentId ? (
                  <button
                    className="adm-link"
                    onClick={() => copy(r.razorpayPaymentId ?? "")}
                    title="Copy"
                  >
                    {r.razorpayPaymentId}
                  </button>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Registration ID</dt>
              <dd>
                <button className="adm-link" onClick={() => copy(r.id)} title="Copy">
                  {r.id}
                </button>
              </dd>
            </div>
          </dl>
          <table className="adm-table adm-members">
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Roll no</th>
                <th>Role</th>
              </tr>
            </thead>
            <tbody>
              {r.members.map((m, i) => (
                <tr key={m.roll_no}>
                  <td>{i + 1}</td>
                  <td>{m.name}</td>
                  <td>{m.roll_no}</td>
                  <td>{m.is_leader ? "Leader" : "Member"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
