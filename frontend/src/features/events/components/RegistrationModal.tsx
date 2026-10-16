import { useEffect, useRef, useState } from "react";
import {
  cancelPendingRegistration,
  getRegistrationStatus,
  startEventRegistration,
  verifyEventPayment,
} from "../registration/api";
import type { FestEvent } from "../data/eventDetails";
import { feePill, formatFee } from "../format";
import {
  YEARS,
  amountPaise,
  normalizeRollNo,
  registrationSchema,
  teamProblems,
  type RegistrationInput,
} from "../registration/schema";
import { payWithRazorpay } from "../registration/razorpayCheckout";
import { CloseIcon } from "./eventIcons";
import RegistrationReceipt from "./RegistrationReceipt";

type Phase = "form" | "submitting" | "paying" | "verifying" | "unpaid" | "done" | "failed";

interface PendingPayment {
  registrationId: string;
  leaderRollNo: string;
  orderId: string;
  amount: number;
  keyId: string;
  prefill: { name: string; email: string; contact: string };
  holdUntil: number;
}

const pendingKey = (eventId: string) => `udgam_pending_registration_${eventId}`;

function loadPending(eventId: string): PendingPayment | null {
  try {
    const raw = sessionStorage.getItem(pendingKey(eventId));
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingPayment;
    return p && typeof p.holdUntil === "number" && p.holdUntil > Date.now() ? p : null;
  } catch {
    return null;
  }
}

function savePending(eventId: string, p: PendingPayment | null) {
  try {
    if (p) sessionStorage.setItem(pendingKey(eventId), JSON.stringify(p));
    else sessionStorage.removeItem(pendingKey(eventId));
  } catch {
    /* storage unavailable: resuming after a reload just won't work */
  }
}

type FormState = {
  teamName: string;
  leader: {
    name: string;
    rollNo: string;
    email: string;
    phone: string;
    year: string;
    department: string;
    college: string;
  };
  members: { name: string; rollNo: string }[];
};

const emptyForm = (event: FestEvent): FormState => ({
  teamName: "",
  leader: {
    name: "",
    rollNo: "",
    email: "",
    phone: "",
    year: "",
    department: "",
    college: "NIT Sikkim",
  },
  members: Array.from({ length: Math.max(0, event.teamSize.min - 1) }, () => ({
    name: "",
    rollNo: "",
  })),
});

const sizeText = (event: FestEvent) => {
  const { min, max } = event.teamSize;
  if (max === 1) return "Individual event";
  return min === max ? `Team of exactly ${min}` : `Team of ${min}–${max}`;
};

export default function RegistrationModal({
  event,
  onClose,
  onRegistered,
  receiptId,
}: {
  event: FestEvent;
  onClose: () => void;
  onRegistered: (eventId: string, registrationId: string) => void;
  /** open straight on the receipt of an existing registration */
  receiptId?: string | undefined;
}) {
  const [form, setForm] = useState<FormState>(() => emptyForm(event));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [problems, setProblems] = useState<string[]>([]);
  const [phase, setPhase] = useState<Phase>(receiptId ? "done" : "form");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingPayment | null>(null);
  const [registrationId, setRegistrationId] = useState<string | null>(receiptId ?? null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const busy = phase === "submitting" || phase === "paying" || phase === "verifying";
  const busyRef = useRef(busy);
  busyRef.current = busy;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const onRegisteredRef = useRef(onRegistered);
  onRegisteredRef.current = onRegistered;

  const { min, max } = event.teamSize;
  const isTeam = max > 1;
  const size = 1 + form.members.length;
  const total = amountPaise(event, size) / 100;
  const feeTba = event.fee === null;

  // resume an unpaid registration from earlier in this browser session — but ask the server
  // first, so a payment that already went through is never offered for payment again
  useEffect(() => {
    if (receiptId) return undefined; // showing an existing receipt
    const p = loadPending(event.id);
    if (!p) return undefined;
    let alive = true;
    setPending(p);
    setRegistrationId(p.registrationId);
    setPhase("submitting");
    getRegistrationStatus({ data: { registrationId: p.registrationId } })
      .catch(() => undefined)
      .then((s) => {
        if (!alive) return;
        if (s?.status === "confirmed") {
          savePending(event.id, null);
          setPending(null);
          setPhase("done");
          onRegisteredRef.current(event.id, p.registrationId);
        } else if (s === undefined || s?.status === "pending") {
          // pending, or status unknown (offline): let them pay or cancel
          setPhase("unpaid");
        } else {
          savePending(event.id, null);
          setPending(null);
          setPhase(s?.status === "refund_required" ? "failed" : "form");
          setMessage(
            s?.status === "refund_required"
              ? "Your payment arrived after the hold expired and a spot was taken. The organisers will refund you."
              : null,
          );
        }
      });
    return () => {
      alive = false;
    };
  }, [event.id, receiptId]);

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busyRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  const setLeader = (key: keyof FormState["leader"], value: string) =>
    setForm((f) => ({ ...f, leader: { ...f.leader, [key]: value } }));
  const setMember = (i: number, key: "name" | "rollNo", value: string) =>
    setForm((f) => ({
      ...f,
      members: f.members.map((m, j) => (j === i ? { ...m, [key]: value } : m)),
    }));
  const addMember = () =>
    setForm((f) =>
      1 + f.members.length < max ? { ...f, members: [...f.members, { name: "", rollNo: "" }] } : f,
    );
  const removeMember = (i: number) =>
    setForm((f) =>
      1 + f.members.length > min ? { ...f, members: f.members.filter((_, j) => j !== i) } : f,
    );

  const payload = (): RegistrationInput => ({
    eventId: event.id,
    teamName: isTeam ? form.teamName : "",
    leader: { ...form.leader, year: form.leader.year as RegistrationInput["leader"]["year"] },
    members: form.members,
  });

  /** Client-side check mirroring the server rules. Returns true if the form looks valid. */
  const validate = (): boolean => {
    const result = registrationSchema.safeParse(payload());
    const fieldErrors: Record<string, string> = {};
    if (!result.success) {
      for (const issue of result.error.issues) {
        const key = issue.path.join(".");
        if (!fieldErrors[key]) fieldErrors[key] = issue.message;
      }
      setErrors(fieldErrors);
      setProblems([]);
      return false;
    }
    const team = teamProblems(event, result.data);
    setErrors({});
    setProblems(team);
    return team.length === 0;
  };

  const markConflicts = (rolls: { rollNo: string; pending: boolean }[]) => {
    const fieldErrors: Record<string, string> = {};
    for (const c of rolls) {
      const text = c.pending
        ? "In another team with a payment in progress"
        : "Already registered for this event";
      if (normalizeRollNo(form.leader.rollNo) === c.rollNo) fieldErrors["leader.rollNo"] = text;
      form.members.forEach((m, i) => {
        if (normalizeRollNo(m.rollNo) === c.rollNo) fieldErrors[`members.${i}.rollNo`] = text;
      });
    }
    setErrors(fieldErrors);
  };

  /** Fresh, empty form (after a successful registration on a shared device). */
  const startOver = () => {
    setForm(emptyForm(event));
    setErrors({});
    setProblems([]);
    setMessage(null);
    setPending(null);
    setRegistrationId(null);
    setPhase("form");
  };

  const finishRegistered = (id: string) => {
    savePending(event.id, null);
    setPending(null);
    setRegistrationId(id);
    setPhase("done");
    onRegistered(event.id, id);
  };

  /** After a payment the browser couldn't confirm, the webhook may still confirm it. */
  const waitForWebhook = async (id: string): Promise<boolean> => {
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      const s = await getRegistrationStatus({ data: { registrationId: id } }).catch(() => null);
      if (s?.status === "confirmed") return true;
      if (s && s.status !== "pending") return false;
    }
    return false;
  };

  const pay = async (p: PendingPayment) => {
    const secondsLeft = Math.floor((p.holdUntil - Date.now()) / 1000);
    if (secondsLeft < 90) {
      // too close to expiry to pay safely: release the spots now so resubmitting doesn't clash
      setPhase("submitting");
      const res = await cancelPendingRegistration({
        data: { registrationId: p.registrationId, leaderRollNo: p.leaderRollNo },
      }).catch(() => null);
      if (res?.status === "confirmed") {
        finishRegistered(p.registrationId);
        return;
      }
      savePending(event.id, null);
      setPending(null);
      setPhase("form");
      setMessage("Your earlier hold has expired. Please submit the registration again.");
      return;
    }
    setPhase("paying");
    setMessage(null);
    const outcome = await payWithRazorpay({
      keyId: p.keyId,
      orderId: p.orderId,
      amountPaise: p.amount,
      description: `${event.name} registration`,
      prefill: p.prefill,
      // close the checkout a minute before the server releases the spots
      timeoutSeconds: secondsLeft - 60,
    });

    if (outcome.kind === "dismissed") {
      setPhase("unpaid");
      return;
    }
    if (outcome.kind === "error") {
      setPhase("unpaid");
      setMessage(outcome.message);
      return;
    }

    setPhase("verifying");
    const res = await verifyEventPayment({
      data: {
        orderId: outcome.orderId,
        paymentId: outcome.paymentId,
        signature: outcome.signature,
      },
    }).catch(() => null);
    if (res?.ok) {
      finishRegistered(res.registrationId);
      return;
    }
    if (res && res.code === "refund_required") {
      savePending(event.id, null);
      setPhase("failed");
      setMessage(`${res.message} Payment ID: ${outcome.paymentId}`);
      return;
    }
    if (await waitForWebhook(p.registrationId)) {
      finishRegistered(p.registrationId);
      return;
    }
    setPhase("failed");
    setMessage(
      `${res?.message ?? "We couldn't confirm your payment yet."} Keep this payment ID for reference: ${outcome.paymentId}`,
    );
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || feeTba) return;
    setMessage(null);
    if (!validate()) return;

    setPhase("submitting");
    const res = await startEventRegistration({ data: payload() }).catch(() => null);
    if (!res) {
      setPhase("form");
      setMessage("Couldn't reach the server. Check your connection and try again.");
      return;
    }
    if (!res.ok) {
      setPhase("form");
      setMessage(res.message);
      if (res.problems) setProblems(res.problems);
      if (res.conflicts) markConflicts(res.conflicts);
      return;
    }
    if (res.status === "confirmed") {
      finishRegistered(res.registrationId);
      return;
    }
    const p: PendingPayment = {
      registrationId: res.registrationId,
      leaderRollNo: normalizeRollNo(form.leader.rollNo),
      orderId: res.order.id,
      amount: res.order.amount,
      keyId: res.order.keyId,
      prefill: res.prefill,
      holdUntil: Date.now() + res.holdMinutes * 60_000,
    };
    savePending(event.id, p);
    setPending(p);
    setRegistrationId(res.registrationId);
    await pay(p);
  };

  const cancelUnpaid = async () => {
    if (!pending) return;
    setPhase("submitting");
    const res = await cancelPendingRegistration({
      data: { registrationId: pending.registrationId, leaderRollNo: pending.leaderRollNo },
    }).catch(() => null);
    if (res?.status === "confirmed") {
      // the payment went through after all (e.g. confirmed by the webhook)
      finishRegistered(pending.registrationId);
      return;
    }
    if (res?.status === "cancelled" || res?.status === "expired" || res?.status === "not_found") {
      savePending(event.id, null);
      setPending(null);
      setPhase("form");
      setMessage("Registration cancelled. You can edit the details and submit again.");
      return;
    }
    setPhase("unpaid");
    setMessage("Couldn't cancel right now. Please try again.");
  };

  const err = (key: string) =>
    errors[key] ? (
      <span className="ep-reg-error" id={`ep-err-${key}`}>
        {errors[key]}
      </span>
    ) : null;
  const aria = (key: string) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `ep-err-${key}` : undefined,
  });

  const holdTime = pending
    ? new Date(pending.holdUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <div className="ep-reg-layer">
      <div className="ep-reg-scrim" onClick={busy ? undefined : onClose} aria-hidden="true" />
      <div
        className="ep-reg-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-reg-title"
        tabIndex={-1}
        ref={dialogRef}
      >
        <div className="ep-reg-head">
          <div>
            <p className="ep-reg-eyebrow">
              {sizeText(event)} · {feePill(event)}
            </p>
            <h2 id="ep-reg-title" className="ep-reg-title">
              {phase === "done" ? `You're in — ${event.name} 🌸` : `Register for ${event.name}`}
            </h2>
          </div>
          <button
            type="button"
            className="ep-icon-btn"
            onClick={onClose}
            disabled={busy}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        {phase === "done" && registrationId ? (
          <RegistrationReceipt
            registrationId={registrationId}
            onClose={onClose}
            onRegisterAnother={startOver}
          />
        ) : phase === "failed" ? (
          <div className="ep-reg-body ep-reg-result">
            <p className="ep-reg-result-title">Payment needs attention</p>
            <p role="alert">{message}</p>
            {registrationId && (
              <p className="ep-reg-muted">
                Registration ID: <code>{registrationId}</code>
              </p>
            )}
            <button type="button" className="ep-checkout" onClick={onClose}>
              Close
            </button>
          </div>
        ) : pending && phase !== "form" ? (
          <div className="ep-reg-body ep-reg-result">
            <p className="ep-reg-result-title" role="status">
              {phase === "paying"
                ? "Complete the payment in the Razorpay window"
                : phase === "verifying"
                  ? "Confirming your payment…"
                  : phase === "submitting"
                    ? "Please wait…"
                    : "Payment not completed"}
            </p>
            <p>
              Your {isTeam ? "team's spots are" : "spot is"} held until <strong>{holdTime}</strong>.
              Pay before then to confirm the registration, or cancel it to change the details.
            </p>
            {message && (
              <p className="ep-tray-notice" role="alert">
                {message}
              </p>
            )}
            <button
              type="button"
              className="ep-checkout"
              onClick={() => pending && pay(pending)}
              disabled={busy || !pending}
            >
              Pay {pending ? formatFee(pending.amount / 100) : ""} now
            </button>
            <button type="button" className="ep-btn-ghost" onClick={cancelUnpaid} disabled={busy}>
              Cancel registration &amp; edit details
            </button>
          </div>
        ) : (
          <form className="ep-reg-body" onSubmit={submit} noValidate>
            {feeTba && (
              <p className="ep-tray-notice" role="status">
                The entry fee for {event.name} hasn't been announced yet. Registration opens once it
                is.
              </p>
            )}
            {isTeam && (
              <label className="ep-reg-field">
                <span>Team name</span>
                <input
                  value={form.teamName}
                  onChange={(e) => setForm((f) => ({ ...f, teamName: e.target.value }))}
                  maxLength={60}
                  {...aria("teamName")}
                />
                {err("teamName")}
              </label>
            )}

            <fieldset className="ep-reg-group">
              <legend>{isTeam ? "Team leader" : "Your details"}</legend>
              <div className="ep-reg-grid">
                <label className="ep-reg-field">
                  <span>Full name</span>
                  <input
                    value={form.leader.name}
                    onChange={(e) => setLeader("name", e.target.value)}
                    autoComplete="name"
                    maxLength={80}
                    {...aria("leader.name")}
                  />
                  {err("leader.name")}
                </label>
                <label className="ep-reg-field">
                  <span>Roll number</span>
                  <input
                    value={form.leader.rollNo}
                    onChange={(e) => setLeader("rollNo", e.target.value)}
                    autoCapitalize="characters"
                    maxLength={20}
                    {...aria("leader.rollNo")}
                  />
                  {err("leader.rollNo")}
                </label>
                <label className="ep-reg-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={form.leader.email}
                    onChange={(e) => setLeader("email", e.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    {...aria("leader.email")}
                  />
                  {err("leader.email")}
                </label>
                <label className="ep-reg-field">
                  <span>Mobile number</span>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={form.leader.phone}
                    onChange={(e) => setLeader("phone", e.target.value)}
                    autoComplete="tel"
                    maxLength={16}
                    {...aria("leader.phone")}
                  />
                  {err("leader.phone")}
                </label>
                <label className="ep-reg-field">
                  <span>Year</span>
                  <select
                    value={form.leader.year}
                    onChange={(e) => setLeader("year", e.target.value)}
                    {...aria("leader.year")}
                  >
                    <option value="">Select…</option>
                    {YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                  {err("leader.year")}
                </label>
                <label className="ep-reg-field">
                  <span>Department / branch</span>
                  <input
                    value={form.leader.department}
                    onChange={(e) => setLeader("department", e.target.value)}
                    maxLength={60}
                    {...aria("leader.department")}
                  />
                  {err("leader.department")}
                </label>
                <label className="ep-reg-field ep-reg-wide">
                  <span>College</span>
                  <input
                    value={form.leader.college}
                    onChange={(e) => setLeader("college", e.target.value)}
                    autoComplete="organization"
                    maxLength={100}
                    {...aria("leader.college")}
                  />
                  {err("leader.college")}
                </label>
              </div>
            </fieldset>

            {isTeam && (
              <fieldset className="ep-reg-group">
                <legend>
                  Team members{" "}
                  <span className="ep-reg-muted">
                    ({size} of {min === max ? min : `${min}–${max}`})
                  </span>
                </legend>
                {form.members.map((m, i) => (
                  <div className="ep-reg-member" key={i}>
                    <span className="ep-reg-member-no">{i + 2}</span>
                    <label className="ep-reg-field">
                      <span>Name</span>
                      <input
                        value={m.name}
                        onChange={(e) => setMember(i, "name", e.target.value)}
                        maxLength={80}
                        {...aria(`members.${i}.name`)}
                      />
                      {err(`members.${i}.name`)}
                    </label>
                    <label className="ep-reg-field">
                      <span>Roll number</span>
                      <input
                        value={m.rollNo}
                        onChange={(e) => setMember(i, "rollNo", e.target.value)}
                        autoCapitalize="characters"
                        maxLength={20}
                        {...aria(`members.${i}.rollNo`)}
                      />
                      {err(`members.${i}.rollNo`)}
                    </label>
                    {size > min && (
                      <button
                        type="button"
                        className="ep-icon-btn is-small"
                        onClick={() => removeMember(i)}
                        aria-label={`Remove member ${i + 2}`}
                      >
                        <CloseIcon />
                      </button>
                    )}
                  </div>
                ))}
                {size < max && (
                  <button type="button" className="ep-btn-ghost" onClick={addMember}>
                    + Add member
                  </button>
                )}
              </fieldset>
            )}

            {(problems.length > 0 || message) && (
              <div className="ep-tray-notice" role="alert">
                {message && <p>{message}</p>}
                {problems
                  .filter((p) => p !== message)
                  .map((p) => (
                    <p key={p}>{p}</p>
                  ))}
              </div>
            )}

            <div className="ep-reg-foot">
              <div>
                <span className="ep-drawer-fee">{formatFee(total)}</span>
                <span className="ep-drawer-fee-label">
                  {total > 0 ? "to pay" : "no payment needed"}
                </span>
              </div>
              <button type="submit" className="ep-checkout ep-reg-submit" disabled={busy || feeTba}>
                {phase === "submitting"
                  ? "Checking…"
                  : phase === "paying"
                    ? "Complete payment…"
                    : phase === "verifying"
                      ? "Confirming payment…"
                      : total > 0
                        ? "Continue to payment"
                        : "Register"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
