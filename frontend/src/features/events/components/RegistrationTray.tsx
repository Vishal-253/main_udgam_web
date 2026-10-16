import { useEffect, useRef, useState } from "react";
import { cssVars } from "@/lib/css-vars";
import type { FestEvent } from "../data/eventDetails";
import { formatFee } from "../format";
import RegistrationModal from "./RegistrationModal";
import { categoryOf } from "../utils";
import { CategoryIcon, CloseIcon, TicketIcon } from "./eventIcons";

/** Floating "event pass": the events picked so far; each one is registered (and paid) separately. */
export default function RegistrationTray({
  items,
  onRemove,
  onClear,
  onOpenEvent,
}: {
  items: FestEvent[];
  onRemove: (id: string) => void;
  onClear: () => void;
  onOpenEvent: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [registering, setRegistering] = useState<FestEvent | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const total = items.reduce((sum, e) => sum + e.fee, 0);

  useEffect(() => {
    if (items.length === 0) {
      setExpanded(false);
      setNotice(null);
    }
  }, [items.length]);

  useEffect(() => {
    if (!expanded) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [expanded]);

  const modal = registering && (
    <RegistrationModal
      event={registering}
      onClose={() => setRegistering(null)}
      onRegistered={(id) => {
        setNotice(`Registered for ${registering.name}.`);
        onRemove(id);
      }}
    />
  );

  // keep the modal mounted after the last event leaves the pass (its success screen is showing)
  if (items.length === 0) return modal || null;

  return (
    <>
      <div className={`ep-tray ${expanded ? "is-expanded" : ""}`} ref={panelRef}>
        {expanded && (
          <div className="ep-tray-panel" role="dialog" aria-label="Your event pass">
            <div className="ep-tray-head">
              <p className="ep-tray-title">Your event pass</p>
              <button type="button" className="ep-link-btn" onClick={onClear}>
                Clear all
              </button>
            </div>
            <ul className="ep-tray-list">
              {items.map((e) => (
                <li key={e.id} style={cssVars({ "--hue": categoryOf(e.category).hue })}>
                  <CategoryIcon id={e.category} className="ep-tray-item-icon" />
                  <button
                    type="button"
                    className="ep-tray-item-name"
                    onClick={() => {
                      setExpanded(false);
                      onOpenEvent(e.id);
                    }}
                  >
                    {e.name}
                  </button>
                  <span className="ep-tray-item-fee">{formatFee(e.fee)}</span>
                  <button
                    type="button"
                    className="ep-tray-register"
                    onClick={() => {
                      setExpanded(false);
                      setRegistering(e);
                    }}
                  >
                    Register
                  </button>
                  <button
                    type="button"
                    className="ep-icon-btn is-small"
                    onClick={() => onRemove(e.id)}
                    aria-label={`Remove ${e.name}`}
                  >
                    <CloseIcon />
                  </button>
                </li>
              ))}
            </ul>
            <div className="ep-tray-total">
              <span>Total</span>
              <strong>{formatFee(total)}</strong>
            </div>
            {notice && (
              <p className="ep-tray-notice" role="status">
                {notice}
              </p>
            )}
            <p className="ep-tray-hint">
              Each event is registered separately: tap <strong>Register</strong>, add your team and
              pay.
            </p>
          </div>
        )}

        <button
          type="button"
          className="ep-tray-bar"
          aria-expanded={expanded}
          onClick={() => setExpanded((v) => !v)}
        >
          <TicketIcon className="ep-tray-bar-icon" />
          <span className="ep-tray-bar-count">
            {items.length} {items.length === 1 ? "event" : "events"}
          </span>
          <span className="ep-tray-bar-total">{formatFee(total)}</span>
          <span className="ep-tray-bar-cta">{expanded ? "Hide" : "Review"}</span>
        </button>
      </div>
      {modal}
    </>
  );
}
