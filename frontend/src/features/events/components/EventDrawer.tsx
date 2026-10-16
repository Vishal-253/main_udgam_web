import { useEffect, useRef, useState } from "react";
import { cssVars } from "@/lib/css-vars";
import type { FestEvent } from "../data/eventDetails";
import { feeLabel, formatFee } from "../format";
import { CategoryChip, RegisterButton } from "./EventBits";
import { categoryOf } from "../utils";
import { ArrowIcon, CloseIcon, DocIcon } from "./eventIcons";

/** Side sheet on desktop, bottom sheet on phones, with the full event details. */
export default function EventDrawer({
  event,
  added,
  onToggle,
  onClose,
}: {
  event: FestEvent | null;
  added: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  // keep the last event rendered while the sheet animates closed
  const [shown, setShown] = useState(event);
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (event) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setShown(event);
      requestAnimationFrame(() => setOpen(true));
    } else {
      setOpen(false);
    }
  }, [event]);

  useEffect(() => {
    if (!open) return undefined;
    closeRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!shown) return null;
  const cat = categoryOf(shown.category);

  return (
    <div
      className={`ep-drawer-layer ${open ? "is-open" : ""}`}
      onTransitionEnd={(e) => {
        if (!open && e.target === e.currentTarget) setShown(null);
      }}
    >
      <div className="ep-drawer-scrim" onClick={onClose} aria-hidden="true" />
      <aside
        className="ep-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ep-drawer-title"
        style={cssVars({ "--hue": cat.hue })}
      >
        <div className="ep-drawer-head">
          <div className="ep-drawer-tags">
            <span className="ep-tier-tag">
              {shown.tier === "major" ? "Headliner" : "Open floor"}
            </span>
            <CategoryChip id={shown.category} small />
          </div>
          <button
            ref={closeRef}
            type="button"
            className="ep-icon-btn"
            onClick={onClose}
            aria-label="Close details"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="ep-drawer-body">
          <h2 id="ep-drawer-title" className="ep-drawer-title">
            {shown.name}
          </h2>

          {shown.description && <p className="ep-drawer-desc">{shown.description}</p>}

          {shown.rounds && (
            <section className="ep-drawer-block">
              <h3>Rounds</h3>
              <ol className="ep-rounds">
                {shown.rounds.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ol>
            </section>
          )}

          {shown.taglines.length > 0 && (
            <section className="ep-drawer-block">
              <h3>The vibe</h3>
              {shown.taglines.map((t) => (
                <p key={t} className="ep-quote">
                  {t}
                </p>
              ))}
            </section>
          )}

          <section className="ep-drawer-block">
            <h3>Rules &amp; format</h3>
            {shown.docUrl ? (
              <a
                className="ep-doc-link"
                href={shown.docUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <DocIcon className="ep-doc-icon" />
                <span>
                  <strong>Open the event document</strong>
                  <small>Full rules, format and judging · Google Docs</small>
                </span>
                <ArrowIcon className="ep-btn-icon" />
              </a>
            ) : (
              <p className="ep-muted">Detailed rules will be announced soon.</p>
            )}
          </section>
        </div>

        <div className="ep-drawer-foot">
          <div>
            <span className="ep-drawer-fee">{formatFee(shown.fee)}</span>
            <span className="ep-drawer-fee-label">{feeLabel(shown)}</span>
          </div>
          <RegisterButton added={added} onToggle={onToggle} eventName={shown.name} size="lg" />
        </div>
      </aside>
    </div>
  );
}
