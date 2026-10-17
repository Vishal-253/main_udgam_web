import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cssVars } from "@/lib/css-vars";
import {
  type EventCategory,
  type EventCategoryId,
  type EventTier,
  type FestEvent,
} from "./data/eventDetails";
import { feeLabel, feePill, formatFee } from "./format";
import { useRegistrations } from "./hooks/useRegistrations";
import { CategoryChip, RegisterButton, RotatingTagline } from "./components/EventBits";
import { categoryOf } from "./utils";
import {
  ArrowIcon,
  BookIcon,
  CategoryIcon,
  CloseIcon,
  DocIcon,
  SearchIcon,
} from "./components/eventIcons";
import EventDrawer from "./components/EventDrawer";
import RegistrationModal from "./components/RegistrationModal";
import HeadlinerCarousel from "./components/HeadlinerCarousel";
import NoticeTicker from "./components/NoticeTicker";
import RulebookViewer from "./components/RulebookViewer";

// Headliner order: the first one starts in the centre of the carousel.
const SPOTLIGHT_ORDER = [
  "dance-competition",
  "food-fiesta",
  "treasure-hunt",
  "ipl-auction",
  "ramp-walk",
  "singing-competition",
  "wall-painting",
  "housie",
  "spoil-the-tshirt",
];

type SortId = "featured" | "fee-asc" | "fee-desc" | "name";
type Comparator = (a: FestEvent, b: FestEvent) => number;

const SORTS: Record<SortId, { label: string; fn: Comparator | null }> = {
  featured: { label: "Featured", fn: null },
  // fees still to be announced sort last either way
  "fee-asc": { label: "Fee: low to high", fn: (a, b) => (a.fee ?? Infinity) - (b.fee ?? Infinity) },
  "fee-desc": { label: "Fee: high to low", fn: (a, b) => (b.fee ?? -1) - (a.fee ?? -1) },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};

const TIERS: { id: EventTier | "all"; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "major", label: "Headliners" },
  { id: "regular", label: "Open floor" },
];

/** Which events a tier tab covers: "Open floor" lists every event, headliners included. */
const inTier = (e: FestEvent, tier: EventTier | "all") => tier !== "major" || e.tier === "major";

const searchText = (e: FestEvent) =>
  [e.name, categoryOf(e.category).label, e.description, ...e.taglines, ...(e.rounds ?? [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

export default function EventsPage({
  events,
  categories,
}: {
  events: FestEvent[];
  categories: EventCategory[];
}) {
  const [query, setQuery] = useState("");
  const [tier, setTier] = useState<EventTier | "all">("all");
  const [category, setCategory] = useState<EventCategoryId | "all">("all");
  const [sort, setSort] = useState<SortId>("featured");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rulebookEvent, setRulebookEvent] = useState<FestEvent | null>(null);
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { registered, record } = useRegistrations(eventIds);
  // the event whose registration form (or receipt) is open
  const [registering, setRegistering] = useState<FestEvent | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // "/" focuses search (desktop convenience)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || openId) return;
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = events.filter(
      (e) =>
        inTier(e, tier) &&
        (category === "all" || e.category === category) &&
        (!q || searchText(e).includes(q)),
    );
    const compare = SORTS[sort].fn;
    if (compare) list = [...list].sort(compare);
    return list;
  }, [events, query, tier, category, sort]);

  const headliners = useMemo(() => {
    if (tier === "regular") return [];
    const list = filtered.filter((e) => e.tier === "major");
    return sort === "featured"
      ? list.sort((a, b) => SPOTLIGHT_ORDER.indexOf(a.id) - SPOTLIGHT_ORDER.indexOf(b.id))
      : list;
  }, [filtered, sort, tier]);
  // Open floor = every event (headliners first when featured), so none is only in the carousel
  const openFloor = useMemo(() => {
    if (tier === "major") return [];
    if (sort !== "featured") return filtered;
    const majors = filtered
      .filter((e) => e.tier === "major")
      .sort((a, b) => SPOTLIGHT_ORDER.indexOf(a.id) - SPOTLIGHT_ORDER.indexOf(b.id));
    return [...majors, ...filtered.filter((e) => e.tier !== "major")];
  }, [filtered, sort, tier]);

  const counts = useMemo(() => {
    const tierEvents = events.filter((e) => inTier(e, tier));
    const c: Record<string, number> = { all: tierEvents.length };
    categories.forEach((cat) => {
      c[cat.id] = tierEvents.filter((e) => e.category === cat.id).length;
    });
    return c;
  }, [events, categories, tier]);

  const isFiltered = query || tier !== "all" || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setTier("all");
    setCategory("all");
  };

  const freeCount = events.filter((e) => e.fee === 0).length;
  const openEvent = events.find((e) => e.id === openId) ?? null;

  return (
    <div className="udgam-events ep-root">
      <NoticeTicker />

      {/* ------------------------------------------------------------ Header */}
      <header className="ep-hero">
        <p className="ep-eyebrow">Udgam 2026 · Event programme</p>
        <h1 className="ep-title">
          Pick your <em>stage.</em>
        </h1>
        <p className="ep-lede">
          {events.length} events across games, sport, performance, food and more. Tap Register on
          any event to sign up your team and get your receipt instantly.
        </p>
        <dl className="ep-stats">
          <div>
            <dt>Events</dt>
            <dd>{events.length}</dd>
          </div>
          <div>
            <dt>Headliners</dt>
            <dd>{events.filter((e) => e.tier === "major").length}</dd>
          </div>
          <div>
            <dt>Categories</dt>
            <dd>{categories.length}</dd>
          </div>
          <div>
            <dt>Free entry</dt>
            <dd>{freeCount}</dd>
          </div>
        </dl>
      </header>

      {/* ------------------------------------------------------ Control bar */}
      <div className="ep-controls" role="search">
        <div className="ep-controls-row">
          <label className="ep-search">
            <SearchIcon className="ep-search-icon" />
            <span className="ep-visually-hidden">Search events</span>
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search events, games, taglines…"
              autoComplete="off"
            />
            {query ? (
              <button
                type="button"
                className="ep-search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <CloseIcon />
              </button>
            ) : (
              <kbd className="ep-kbd" aria-hidden="true">
                /
              </kbd>
            )}
          </label>

          <div className="ep-segment" role="tablist" aria-label="Event type">
            {TIERS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tier === t.id}
                className={tier === t.id ? "is-active" : ""}
                onClick={() => setTier(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>

          <label className="ep-sort">
            <span className="ep-visually-hidden">Sort events</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortId)}>
              {Object.entries(SORTS).map(([id, s]) => (
                <option key={id} value={id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="ep-chips" aria-label="Filter by category">
          <button
            type="button"
            className={`ep-chip ${category === "all" ? "is-active" : ""}`}
            aria-pressed={category === "all"}
            onClick={() => setCategory("all")}
          >
            All <span className="ep-chip-count">{counts["all"]}</span>
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`ep-chip ${category === cat.id ? "is-active" : ""}`}
              style={cssVars({ "--hue": cat.hue })}
              aria-pressed={category === cat.id}
              disabled={!counts[cat.id]}
              onClick={() => setCategory(category === cat.id ? "all" : cat.id)}
            >
              <CategoryIcon id={cat.id} className="ep-chip-icon" />
              {cat.label} <span className="ep-chip-count">{counts[cat.id] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {isFiltered && (
        <p className="ep-result-line" aria-live="polite">
          Showing <strong>{filtered.length}</strong> of {events.length} events
          <button type="button" className="ep-link-btn" onClick={resetFilters}>
            Clear filters
          </button>
        </p>
      )}

      {/* -------------------------------------------------------- Headliners */}
      {headliners.length > 0 && (
        <section className="ep-section" aria-labelledby="ep-headliners">
          <div className="ep-section-head">
            <h2 id="ep-headliners">Headliners</h2>
            <p>The big-stage events of Udgam.</p>
          </div>
          {headliners.length >= 3 ? (
            <HeadlinerCarousel
              items={headliners}
              getKey={(e) => e.id}
              paused={openId !== null || rulebookEvent !== null}
              label="Headliners"
              renderItem={(e, i) => (
                <HeadlinerTile
                  event={e}
                  index={i}
                  registered={!!registered[e.id]}
                  onRegister={() => setRegistering(e)}
                  onOpen={() => setOpenId(e.id)}
                  onOpenRulebook={setRulebookEvent}
                />
              )}
            />
          ) : (
            <div className="ep-bento">
              {headliners.map((e, i) => (
                <HeadlinerTile
                  key={e.id}
                  event={e}
                  index={i}
                  registered={!!registered[e.id]}
                  onRegister={() => setRegistering(e)}
                  onOpen={() => setOpenId(e.id)}
                  onOpenRulebook={setRulebookEvent}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {/* -------------------------------------------------------- Open floor */}
      {openFloor.length > 0 && (
        <section className="ep-section" aria-labelledby="ep-open-floor">
          <div className="ep-section-head">
            <h2 id="ep-open-floor">Open floor</h2>
            <p>Every event at the fest, headliners included.</p>
          </div>
          <div className="ep-tickets">
            {openFloor.map((e) => (
              <TicketCard
                key={e.id}
                event={e}
                registered={!!registered[e.id]}
                onRegister={() => setRegistering(e)}
                onOpen={() => setOpenId(e.id)}
                onOpenRulebook={setRulebookEvent}
              />
            ))}
          </div>
        </section>
      )}

      {filtered.length === 0 && (
        <div className="ep-empty">
          <p className="ep-empty-title">No events match that.</p>
          <p>Try a different search or category.</p>
          <button type="button" className="ep-btn-ghost" onClick={resetFilters}>
            Reset filters
          </button>
        </div>
      )}

      <aside className="ep-help">
        <div>
          <p className="ep-help-title">Questions about an event?</p>
          <p>The organising committee leads can help with rules, teams and registration.</p>
        </div>
        <Link to="/team" className="ep-btn-ghost">
          Meet the committee <ArrowIcon className="ep-btn-icon" />
        </Link>
      </aside>

      <EventDrawer
        event={openEvent}
        registered={openEvent ? !!registered[openEvent.id] : false}
        onRegister={() => {
          if (openEvent) setRegistering(openEvent);
        }}
        onClose={() => {
          // the registration form sits on top of the drawer: Escape closes the form first, and
          // never the drawer underneath while the form is busy (that broke the page's scroll lock)
          if (!registering) setOpenId(null);
        }}
      />

      {registering && (
        <RegistrationModal
          key={registering.id}
          event={registering}
          receiptId={registered[registering.id]}
          onClose={() => setRegistering(null)}
          onRegistered={record}
        />
      )}

      {/* Direct rulebook PDF modal */}
      {rulebookEvent && rulebookEvent.rulebookPdf && (
        <RulebookViewer
          pdfUrl={rulebookEvent.rulebookPdf}
          eventName={rulebookEvent.name}
          onClose={() => setRulebookEvent(null)}
        />
      )}
    </div>
  );
}

interface CardProps {
  event: FestEvent;
  registered: boolean;
  onRegister: () => void;
  onOpen: () => void;
  onOpenRulebook: (event: FestEvent) => void;
}

function HeadlinerTile({
  event,
  index,
  registered,
  onRegister,
  onOpen,
  onOpenRulebook,
}: CardProps & { index: number }) {
  const cat = categoryOf(event.category);
  return (
    <article
      className={`ep-tile ${registered ? "is-added" : ""}`}
      style={cssVars({ "--hue": cat.hue })}
    >
      <CategoryIcon id={cat.id} className="ep-tile-glyph" />
      <div className="ep-tile-top">
        <span className="ep-tile-index">{String(index + 1).padStart(2, "0")}</span>
        <CategoryChip id={event.category} small />
        <span className="ep-fee-pill">{feePill(event)}</span>
      </div>

      <h3 className="ep-tile-title">
        <button type="button" className="ep-stretch" onClick={onOpen}>
          {event.name}
        </button>
      </h3>
      <RotatingTagline lines={event.taglines} />
      {event.description && <p className="ep-tile-desc">{event.description}</p>}
      {!event.description && !event.taglines.length && (
        <p className="ep-tile-desc">Full format in the event document.</p>
      )}

      <div className="ep-tile-actions">
        <RegisterButton registered={registered} onRegister={onRegister} eventName={event.name} />
        {event.rulebookPdf ? (
          <button
            type="button"
            className="ep-details-btn ep-rulebook-direct-btn"
            onClick={() => onOpenRulebook(event)}
            title={`View ${event.name} Rulebook`}
          >
            <BookIcon className="ep-btn-icon" />
            Rulebook
          </button>
        ) : event.docUrl ? (
          <a
            href={event.docUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ep-details-btn ep-rulebook-direct-btn"
            title={`Open ${event.name} Rulebook`}
          >
            <DocIcon className="ep-btn-icon" />
            Rulebook
          </a>
        ) : (
          <button type="button" className="ep-details-btn" onClick={onOpen}>
            Details <ArrowIcon className="ep-btn-icon" />
          </button>
        )}
      </div>
    </article>
  );
}

function TicketCard({ event, registered, onRegister, onOpen, onOpenRulebook }: CardProps) {
  const cat = categoryOf(event.category);
  const meta: string[] = [];
  if (event.rounds) meta.push(`${event.rounds.length} rounds`);
  return (
    <article
      className={`ep-ticket ${registered ? "is-added" : ""}`}
      style={cssVars({ "--hue": cat.hue })}
    >
      <div className="ep-ticket-body">
        <CategoryChip id={event.category} small />
        <h3 className="ep-ticket-title">
          <button type="button" className="ep-stretch" onClick={onOpen}>
            {event.name}
          </button>
        </h3>
        <RotatingTagline lines={event.taglines} interval={4200} />
        <div className="ep-ticket-meta">
          {meta.map((m) => (
            <span key={m}>{m}</span>
          ))}
          {event.docUrl && (
            <span className="ep-meta-doc">
              <DocIcon /> Rules doc
            </span>
          )}
        </div>
      </div>
      <div className="ep-ticket-stub">
        <span className="ep-ticket-fee">{formatFee(event.fee)}</span>
        <span className="ep-ticket-fee-label">{feeLabel(event)}</span>
        <div className="ep-ticket-stub-actions">
          <RegisterButton
            registered={registered}
            onRegister={onRegister}
            eventName={event.name}
            size="sm"
          />
          {event.rulebookPdf ? (
            <button
              type="button"
              className="ep-ticket-rb-btn"
              onClick={() => onOpenRulebook(event)}
              title={`View ${event.name} Rulebook`}
            >
              <BookIcon className="ep-btn-icon" />
              <span>Rules</span>
            </button>
          ) : event.docUrl ? (
            <a
              href={event.docUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="ep-ticket-rb-btn"
              title={`Open ${event.name} Rulebook`}
            >
              <DocIcon className="ep-btn-icon" />
              <span>Rules</span>
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}
