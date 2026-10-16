import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { getRegistrationReceipt, type RegistrationReceipt as Receipt } from "../registration/api";
import { formatAmount } from "../format";

// Ticket-style registration receipt, loaded from the backend (the real saved record), with a
// check-in QR code and a "Print / Save as PDF" button that prints only the receipt.

const STATUS: Record<string, { label: string; tone: "ok" | "warn" | "bad" }> = {
  confirmed: { label: "Confirmed", tone: "ok" },
  pending: { label: "Payment pending", tone: "warn" },
  refund_required: { label: "Refund due", tone: "bad" },
  expired: { label: "Expired", tone: "bad" },
  cancelled: { label: "Cancelled", tone: "bad" },
};

const when = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : "—";

export default function RegistrationReceipt({
  registrationId,
  onClose,
  onRegisterAnother,
}: {
  registrationId: string;
  onClose: () => void;
  /** e.g. a friend using the same phone wants to register their own team */
  onRegisterAnother?: () => void;
}) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await getRegistrationReceipt(registrationId);
      if (!r) {
        setError("We couldn't find this registration.");
        return;
      }
      setReceipt(r);
      setQr(
        await QRCode.toDataURL(`UDGAM26:${r.registrationId}`, {
          margin: 1,
          width: 220,
          errorCorrectionLevel: "M",
          color: { dark: "#2a0f1d", light: "#ffffff" },
        }),
      );
    } catch {
      setError("Couldn't load the receipt. Check your connection and try again.");
    }
  }, [registrationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const print = () => {
    const root = document.documentElement;
    root.classList.add("ep-printing-receipt");
    const done = () => {
      root.classList.remove("ep-printing-receipt");
      window.removeEventListener("afterprint", done);
    };
    window.addEventListener("afterprint", done);
    window.print();
    // some mobile browsers never fire afterprint
    setTimeout(done, 60_000);
  };

  if (error) {
    return (
      <div className="ep-reg-body ep-reg-result">
        <p className="ep-reg-result-title">Receipt unavailable</p>
        <p role="alert">{error}</p>
        <p className="ep-reg-muted">
          Registration ID: <code>{registrationId}</code>
        </p>
        <button type="button" className="ep-checkout" onClick={load}>
          Try again
        </button>
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="ep-reg-body ep-reg-result">
        <p className="ep-reg-muted" role="status">
          Preparing your receipt…
        </p>
      </div>
    );
  }

  const status = STATUS[receipt.status] ?? { label: receipt.status, tone: "warn" as const };
  const isTeam = receipt.members.length > 1;
  const receiptNo = receipt.registrationId.slice(0, 8).toUpperCase();

  return (
    <div className="ep-reg-body ep-receipt-wrap">
      <article className="ep-receipt" aria-label={`Registration receipt for ${receipt.eventName}`}>
        <header className="ep-receipt-head">
          <div>
            <p className="ep-receipt-brand">Udgam 2K26 · NIT Sikkim</p>
            <p className="ep-receipt-kicker">Registration receipt</p>
          </div>
          <span className={`ep-receipt-stamp is-${status.tone}`}>{status.label}</span>
        </header>

        <div className="ep-receipt-hero">
          <p className="ep-receipt-label">Event</p>
          <h3 className="ep-receipt-event">{receipt.eventName}</h3>
          {receipt.teamName && <p className="ep-receipt-team">Team “{receipt.teamName}”</p>}
        </div>

        <div className="ep-receipt-grid">
          <div>
            <p className="ep-receipt-label">Receipt no.</p>
            <p className="ep-receipt-value">#{receiptNo}</p>
          </div>
          <div>
            <p className="ep-receipt-label">
              {receipt.confirmedAt ? "Confirmed on" : "Registered on"}
            </p>
            <p className="ep-receipt-value">{when(receipt.confirmedAt ?? receipt.createdAt)}</p>
          </div>
          <div>
            <p className="ep-receipt-label">Amount</p>
            <p className="ep-receipt-value">
              {receipt.amountPaise > 0 ? formatAmount(receipt.amountPaise / 100) : "Free entry"}
            </p>
          </div>
          <div>
            <p className="ep-receipt-label">Payment ID</p>
            <p className="ep-receipt-value ep-receipt-mono">{receipt.paymentId ?? "—"}</p>
          </div>
        </div>

        <div className="ep-receipt-perf" aria-hidden="true" />

        <div className="ep-receipt-body">
          <div className="ep-receipt-people">
            <p className="ep-receipt-label">
              {isTeam ? `Team members (${receipt.members.length})` : "Participant"}
            </p>
            <ol className="ep-receipt-members">
              {receipt.members.map((m) => (
                <li key={m.rollNo}>
                  <span className="ep-receipt-name">{m.name}</span>
                  <span className="ep-receipt-roll">{m.rollNo}</span>
                  {m.isLeader && isTeam && <span className="ep-receipt-badge">Leader</span>}
                </li>
              ))}
            </ol>
            <p className="ep-receipt-contact">
              Contact: {receipt.leaderPhone} · {receipt.leaderEmail}
            </p>
          </div>
          <div className="ep-receipt-qr">
            {qr && (
              <img
                src={qr}
                alt={`Check-in QR code for registration ${receiptNo}`}
                width={132}
                height={132}
              />
            )}
            <p>Show at the event desk</p>
          </div>
        </div>

        <footer className="ep-receipt-foot">
          <span>🌸 Chase the Bloom</span>
          <span className="ep-receipt-mono">{receipt.registrationId}</span>
        </footer>
      </article>

      <p className="ep-reg-muted ep-receipt-note">
        Save this receipt — screenshot it or download the PDF. You can reopen it any time from the
        event's <strong>Registered</strong> button on this device.
      </p>
      <div className="ep-receipt-actions">
        <button type="button" className="ep-btn-ghost" onClick={print}>
          Print / Save as PDF
        </button>
        {onRegisterAnother && (
          <button type="button" className="ep-btn-ghost" onClick={onRegisterAnother}>
            Register another team
          </button>
        )}
        <button type="button" className="ep-checkout" onClick={onClose}>
          Done
        </button>
      </div>
    </div>
  );
}
