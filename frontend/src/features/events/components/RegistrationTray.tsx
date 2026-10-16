import { useEffect, useRef, useState } from "react";
import { registerForEvents } from "@/lib/events.functions";
import { cssVars } from "@/lib/css-vars";
import type { FestEvent } from "../data/eventDetails";
import { formatFee } from "../format";
import { categoryOf } from "../utils";
import { ArrowIcon, CategoryIcon, CloseIcon, TicketIcon } from "./eventIcons";

/** Floating "event pass": the events picked so far, running total and checkout. */
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
  const [busy, setBusy] = useState(false);
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

  if (items.length === 0) return null;

  const checkout = async () => {
    setBusy(true);
    try {
      const res = await registerForEvents({ data: { eventIds: items.map((e) => e.id) } });
      setNotice(res.message);
    } catch {
      setNotice("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
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
          <button type="button" className="ep-checkout" onClick={checkout} disabled={busy}>
            {busy ? "Please wait…" : "Proceed to register"} <ArrowIcon className="ep-btn-icon" />
          </button>
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
  );
}
