import { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from "react";
import { cssVars } from "@/lib/css-vars";
import type { CommitteeDeck } from "../data/teamDecks";
import TeamPassCard from "./TeamPassCard";

const CLOSE_BASE_MS = 520;
const CLOSE_STAGGER_MS = 45;
const CLOSE_MAX_STAGGER_MS = 360;
const DEAL_STAGGER_MS = 95;
const DEAL_MAX_DELAY_MS = 900;

// Fixed per-card variation so the deal looks hand-made but is fully deterministic.
const DEAL_JITTER: { x: number; rot: number }[] = [
  { x: -14, rot: -5 },
  { x: 10, rot: 3.5 },
  { x: -6, rot: -2.5 },
  { x: 16, rot: 5 },
  { x: -10, rot: -4 },
  { x: 6, rot: 2 },
];
const jitterAt = (i: number) => DEAL_JITTER[i % DEAL_JITTER.length] ?? { x: 0, rot: 0 };

/**
 * TeamDeckOverlay
 * An overlay page that appears over the Teams page when an organising committee deck is opened.
 * Full-screen layer over the Teams page that shows only the dealt lead / associate lead
 * cards. Closes via Esc or a click outside the cards.
 */
export default function TeamDeckOverlay({
  deck,
  onClose,
}: {
  deck: CommitteeDeck;
  onClose: () => void;
}) {
  const [dealKey, setDealKey] = useState(0);
  const [isClosing, setIsClosing] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cards travel back down to the deck before the layer is removed.
  const requestClose = useCallback(() => {
    if (closeTimerRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const count = tableRef.current?.children.length ?? 0;
    const total = reduce
      ? 0
      : CLOSE_BASE_MS + Math.min(count * CLOSE_STAGGER_MS, CLOSE_MAX_STAGGER_MS) + 80;
    setIsClosing(true);
    closeTimerRef.current = setTimeout(onClose, total);
  }, [onClose]);

  useEffect(
    () => () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    },
    [],
  );

  // Esc to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [requestClose]);

  // Prevent background scroll while overlay is mounted
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  // When deck changes, reset deal animation and scroll to top
  useEffect(() => {
    setDealKey((k) => k + 1);
  }, [deck.id]);

  // Only leads and associate leads, shown with a plain role ribbon (no committee name)
  const filteredMembers = useMemo(() => {
    const all = deck.members;
    const leads = all.filter((m) => m.role === "Lead" || m.role === "Associate Lead");
    return (leads.length ? leads : all).map((m) => ({
      ...m,
      tag: (m.badgeText || m.role).toUpperCase(),
    }));
  }, [deck.members]);

  // Measure each slot so every card starts below the visible area and travels
  // toward its seat from a common point near the bottom-centre (the deck).
  useLayoutEffect(() => {
    const root = overlayRef.current;
    const table = tableRef.current;
    if (!root || !table) return;
    root.scrollTop = 0;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    Array.from(table.children as HTMLCollectionOf<HTMLElement>).forEach((slot, i) => {
      const rect = slot.getBoundingClientRect();
      const fromY = Math.max(vh - rect.top + 60, 160);
      const fromX = (vw / 2 - (rect.left + rect.width / 2)) * 0.45 + jitterAt(i).x;
      slot.style.setProperty("--from-x", `${Math.round(fromX)}px`);
      slot.style.setProperty("--from-y", `${Math.round(fromY)}px`);
    });
  }, [dealKey, filteredMembers.length]);

  return (
    <div
      className={`deck-page-overlay-root ${isClosing ? "is-closing" : ""}`}
      ref={overlayRef}
      onClick={(e) => {
        // Close if clicking directly on overlay backdrop
        const target = e.target as HTMLElement;
        if (
          target === e.currentTarget ||
          target.classList.contains("deck-overlay-backdrop-hit") ||
          target === tableRef.current
        ) {
          requestClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label={`${deck.title} Organising Committee Passes`}
    >
      {/* Background Translucent Ambient Aura */}
      <div className="deck-overlay-ambient-halo" aria-hidden="true" />

      <div className="deck-overlay-content deck-overlay-backdrop-hit">
        <div className="deck-deal-table" key={dealKey} ref={tableRef}>
          {filteredMembers.map((member, i) => {
            const jitter = jitterAt(i);
            const count = filteredMembers.length;
            return (
              <div
                key={member.id}
                className="deck-deal-card-slot"
                style={cssVars({
                  "--deal-rot": `${jitter.rot}deg`,
                  "--deal-delay": `${Math.min(i * DEAL_STAGGER_MS, DEAL_MAX_DELAY_MS)}ms`,
                  "--out-delay": `${Math.min((count - 1 - i) * CLOSE_STAGGER_MS, CLOSE_MAX_STAGGER_MS)}ms`,
                })}
              >
                <TeamPassCard member={member} />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
