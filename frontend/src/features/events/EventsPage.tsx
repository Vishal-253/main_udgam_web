import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { cssVars } from "@/lib/css-vars";
import {
  cardTaglines,
  type EventCategory,
  type EventCategoryId,
  type EventTier,
  type FestEvent,
} from "./data/eventDetails";
import { formatFee } from "./format";
import { useEventPass } from "./hooks/useEventPass";
import { CategoryChip, RegisterButton, RotatingTagline } from "./components/EventBits";
import { categoryOf } from "./utils";
import { ArrowIcon, CategoryIcon, CloseIcon, DocIcon, SearchIcon } from "./components/eventIcons";
import EventDrawer from "./components/EventDrawer";
import RegistrationTray from "./components/RegistrationTray";
import HeadlinerCarousel from "./components/HeadlinerCarousel";
import NoticeTicker from "./components/NoticeTicker";

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
  "fee-asc": { label: "Fee: low to high", fn: (a, b) => a.fee - b.fee },
  "fee-desc": { label: "Fee: high to low", fn: (a, b) => b.fee - a.fee },
  name: { label: "Name A–Z", fn: (a, b) => a.name.localeCompare(b.name) },
};

const TIERS: { id: EventTier | "all"; label: string }[] = [
  { id: "all", label: "All events" },
  { id: "major", label: "Headliners" },
  { id: "regular", label: "Open floor" },
];

const searchText = (e: FestEvent) =>
  [
    e.name,
    categoryOf(e.category).label,
    e.description,
    ...e.taglines,
    ...(e.rounds ?? []),
    ...(e.games ?? []).flatMap((g) => [g.name, ...g.taglines]),
  ]
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
  const eventIds = useMemo(() => events.map((e) => e.id), [events]);
  const { pass, toggle: togglePass, clear: clearPass } = useEventPass(eventIds);
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
        (tier === "all" || e.tier === tier) &&
        (category === "all" || e.category === category) &&
        (!q || searchText(e).includes(q)),
    );
    const compare = SORTS[sort].fn;
    if (compare) list = [...list].sort(compare);
    return list;
  }, [events, query, tier, category, sort]);

  const headliners = useMemo(() => {
    const list = filtered.filter((e) => e.tier === "major");
    return sort === "featured"
      ? list.sort((a, b) => SPOTLIGHT_ORDER.indexOf(a.id) - SPOTLIGHT_ORDER.indexOf(b.id))
      : list;
  }, [filtered, sort]);
  const openFloor = useMemo(() => filtered.filter((e) => e.tier === "regular"), [filtered]);

  const counts = useMemo(() => {
    const inTier = events.filter((e) => tier === "all" || e.tier === tier);
    const c: Record<string, number> = { all: inTier.length };
    categories.forEach((cat) => {
      c[cat.id] = inTier.filter((e) => e.category === cat.id).length;
    });
    return c;
  }, [events, categories, tier]);

  const isFiltered = query || tier !== "all" || category !== "all";
  const resetFilters = () => {
    setQuery("");
    setTier("all");
    setCategory("all");
  };

  const minFee = Math.min(...events.map((e) => e.fee));
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
          {events.length} events across games, sport, performance, food and more. Add the ones you
          want to your pass and register for them in one go.
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
            <dt>Entry from</dt>
            <dd>{formatFee(minFee)}</dd>
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
              paused={openId !== null}
              label="Headliners"
              renderItem={(e, i) => (
                <HeadlinerTile
                  event={e}
                  index={i}
                  added={pass.includes(e.id)}
                  onToggle={() => togglePass(e.id)}
                  onOpen={() => setOpenId(e.id)}
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
                  added={pass.includes(e.id)}
                  onToggle={() => togglePass(e.id)}
                  onOpen={() => setOpenId(e.id)}
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
            <p>Quick-fire games and contests running through the fest.</p>
          </div>
          <div className="ep-tickets">
            {openFloor.map((e) => (
              <TicketCard
                key={e.id}
                event={e}
                added={pass.includes(e.id)}
                onToggle={() => togglePass(e.id)}
                onOpen={() => setOpenId(e.id)}
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
        added={openEvent ? pass.includes(openEvent.id) : false}
        onToggle={() => {
          if (openEvent) togglePass(openEvent.id);
        }}
        onClose={() => setOpenId(null)}
      />

      <RegistrationTray
        items={pass.map((id) => events.find((e) => e.id === id)).filter((e): e is FestEvent => !!e)}
        onRemove={togglePass}
        onClear={clearPass}
        onOpenEvent={setOpenId}
      />
    </div>
  );
}

interface CardProps {
  event: FestEvent;
  added: boolean;
  onToggle: () => void;
  onOpen: () => void;
}

function HeadlinerTile({ event, index, added, onToggle, onOpen }: CardProps & { index: number }) {
  const cat = categoryOf(event.category);
  return (
    <article className={`ep-tile ${added ? "is-added" : ""}`} style={cssVars({ "--hue": cat.hue })}>
      <CategoryIcon id={cat.id} className="ep-tile-glyph" />
      <div className="ep-tile-top">
        <span className="ep-tile-index">{String(index + 1).padStart(2, "0")}</span>
        <CategoryChip id={event.category} small />
        <span className="ep-fee-pill">{formatFee(event.fee)}</span>
      </div>

      <h3 className="ep-tile-title">
        <button type="button" className="ep-stretch" onClick={onOpen}>
          {event.name}
        </button>
      </h3>
      <RotatingTagline lines={cardTaglines(event)} />
      {event.description && <p className="ep-tile-desc">{event.description}</p>}
      {!event.description && !cardTaglines(event).length && (
        <p className="ep-tile-desc">Full format in the event document.</p>
      )}

      <div className="ep-tile-actions">
        <RegisterButton added={added} onToggle={onToggle} eventName={event.name} />
        <button type="button" className="ep-details-btn" onClick={onOpen}>
          Details <ArrowIcon className="ep-btn-icon" />
        </button>
      </div>
    </article>
  );
}

function TicketCard({ event, added, onToggle, onOpen }: CardProps) {
  const cat = categoryOf(event.category);
  const meta: string[] = [];
  if (event.rounds) meta.push(`${event.rounds.length} rounds`);
  if (event.games) meta.push(event.games.map((g) => g.name).join(" · "));
  return (
    <article
      className={`ep-ticket ${added ? "is-added" : ""}`}
      style={cssVars({ "--hue": cat.hue })}
    >
      <div className="ep-ticket-body">
        <CategoryChip id={event.category} small />
        <h3 className="ep-ticket-title">
          <button type="button" className="ep-stretch" onClick={onOpen}>
            {event.name}
          </button>
        </h3>
        <RotatingTagline lines={cardTaglines(event)} interval={4200} />
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
        <span className="ep-ticket-fee-label">entry</span>
        <RegisterButton added={added} onToggle={onToggle} eventName={event.name} size="sm" />
      </div>
    </article>
  );
}
