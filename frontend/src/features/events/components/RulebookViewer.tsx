import { useEffect, useRef } from "react";
import { CloseIcon } from "./eventIcons";

interface RulebookViewerProps {
  pdfUrl: string;
  eventName: string;
  onClose: () => void;
}

/**
 * Full-screen PDF viewer modal.
 * Renders the PDF in an <iframe> with a premium glassmorphism backdrop.
 */
export default function RulebookViewer({ pdfUrl, eventName, onClose }: RulebookViewerProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const prevFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    prevFocusRef.current = document.activeElement as HTMLElement | null;
    closeRef.current?.focus({ preventScroll: true });

    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
      prevFocusRef.current?.focus({ preventScroll: true });
    };
  }, [onClose]);

  return (
    <div
      className="rb-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`${eventName} rulebook`}
    >
      {/* Backdrop */}
      <div className="rb-backdrop" onClick={onClose} aria-hidden="true" />

      {/* Viewer panel */}
      <div className="rb-panel">
        <header className="rb-header">
          <div className="rb-header-info">
            <span className="rb-label">📋 Rulebook</span>
            <h2 className="rb-title">{eventName}</h2>
          </div>
          <div className="rb-header-actions">
            <a
              className="rb-download-btn"
              href={pdfUrl}
              download
              aria-label={`Download ${eventName} rulebook`}
            >
              <DownloadIcon /> Download
            </a>
            <button
              ref={closeRef}
              type="button"
              className="rb-close-btn"
              onClick={onClose}
              aria-label="Close rulebook"
            >
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="rb-body">
          <iframe
            src={`${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1&view=FitH`}
            title={`${eventName} rulebook`}
            className="rb-iframe"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  );
}

function DownloadIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}
