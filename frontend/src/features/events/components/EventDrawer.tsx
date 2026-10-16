import { useEffect, useRef, useState } from "react";
import { cssVars } from "@/lib/css-vars";
import type { FestEvent } from "../data/eventDetails";
import { feeLabel, formatFee } from "../format";
import { CategoryChip, RegisterButton } from "./EventBits";
import { categoryOf } from "../utils";
import { ArrowIcon, BookIcon, CloseIcon, DocIcon, DownloadIcon, ExpandIcon } from "./eventIcons";
import RulebookViewer from "./RulebookViewer";

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
  const [showRulebook, setShowRulebook] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (event) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      setShown(event);
      setShowRulebook(false);
      requestAnimationFrame(() => setOpen(true));
    } else {
      setOpen(false);
      setShowRulebook(false);
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
    <>
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

            {shown.rulebookPdf ? (
              <section className="ep-drawer-block ep-drawer-rulebook-block">
                <div className="ep-drawer-rb-head">
                  <div className="ep-drawer-rb-meta">
                    <BookIcon className="ep-doc-icon" />
                    <div>
                      <h3 className="ep-drawer-rb-title">Official Rulebook</h3>
                      <p className="ep-drawer-rb-sub">
                        Rules, format, rounds &amp; judging guidelines
                      </p>
                    </div>
                  </div>
                  <div className="ep-drawer-rb-tools">
                    <button
                      type="button"
                      className="ep-drawer-rb-btn"
                      onClick={() => setShowRulebook(true)}
                      title="Open Fullscreen"
                    >
                      <ExpandIcon className="ep-rb-icon" />
                      <span>Fullscreen</span>
                    </button>
                    <a
                      className="ep-drawer-rb-btn"
                      href={shown.rulebookPdf}
                      download
                      title="Download Rulebook PDF"
                    >
                      <DownloadIcon className="ep-rb-icon" />
                      <span>PDF</span>
                    </a>
                  </div>
                </div>

                {/* Directly embedded rulebook */}
                <div className="ep-drawer-pdf-box">
                  <iframe
                    src={`${shown.rulebookPdf}#toolbar=0&navpanes=0&view=FitH`}
                    title={`${shown.name} Rulebook`}
                    className="ep-drawer-pdf-frame"
                    loading="lazy"
                  />
                </div>
              </section>
            ) : shown.docUrl ? (
              <section className="ep-drawer-block">
                <h3>Rules &amp; format</h3>
                <a
                  className="ep-doc-link"
                  href={shown.docUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <DocIcon className="ep-doc-icon" />
                  <span>
                    <strong>Open official rules document</strong>
                    <small>Full rules, format and judging · Google Docs</small>
                  </span>
                  <ArrowIcon className="ep-btn-icon" />
                </a>
              </section>
            ) : (
              <section className="ep-drawer-block">
                <h3>Rules &amp; format</h3>
                <p className="ep-muted">Detailed rules will be announced soon.</p>
              </section>
            )}
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

      {/* Rulebook PDF modal — rendered outside the drawer so it gets its own stacking context */}
      {showRulebook && shown.rulebookPdf && (
        <RulebookViewer
          pdfUrl={shown.rulebookPdf}
          eventName={shown.name}
          onClose={() => setShowRulebook(false)}
        />
      )}
    </>
  );
}
