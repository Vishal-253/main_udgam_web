import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cssVars } from "@/lib/css-vars";
import { prefersReducedMotion } from "../utils";
import { ArrowIcon } from "./eventIcons";

const AUTOPLAY_MS = 4200;
const SWIPE_PX = 40;

/**
 * Coverflow row: three slides visible, the centre one emphasised.
 * Auto-advances right to left; pauses on hover, focus, swipe, an open drawer or when off-screen.
 */
export default function HeadlinerCarousel<T>({
  items,
  renderItem,
  getKey,
  paused = false,
  label,
}: {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  getKey: (item: T) => string;
  paused?: boolean;
  label: string;
}) {
  // with fewer than five slides the wrap-around would show through, so loop a doubled list
  const slides = items.length < 5 ? [...items, ...items] : items;
  const n = slides.length;
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [docHidden, setDocHidden] = useState(false);
  // decided on the client only, so the server render and hydration agree
  const [reducedMotion, setReducedMotion] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const swipeRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => setReducedMotion(prefersReducedMotion()), []);

  const go = useCallback((delta: number) => setActive((i) => (((i + delta) % n) + n) % n), [n]);

  // a filter change can shrink the list under the current index
  useEffect(() => {
    setActive(0);
  }, [items]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const io = new IntersectionObserver(([entry]) => setVisible(entry?.isIntersecting ?? true), {
      threshold: 0.35,
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  const running = !paused && !hovered && !focused && visible && !docHidden && !reducedMotion;
  useEffect(() => {
    if (!running) return undefined;
    const t = setInterval(() => go(1), AUTOPLAY_MS);
    return () => clearInterval(t);
  }, [running, go, active]);

  const onPointerDown = (e: PointerEvent) => {
    if (e.pointerType === "mouse") return;
    swipeRef.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent) => {
    const start = swipeRef.current;
    swipeRef.current = null;
    if (!start) return;
    const dx = e.clientX - start.x;
    if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(e.clientY - start.y))
      go(dx < 0 ? 1 : -1);
  };

  const half = Math.floor(n / 2);
  const realIndex = active % items.length;

  return (
    <div
      className="ep-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label={label}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") go(1);
        else if (e.key === "ArrowLeft") go(-1);
      }}
    >
      <div
        ref={stageRef}
        className="ep-carousel-stage"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          swipeRef.current = null;
        }}
      >
        {slides.map((item, i) => {
          // signed distance from the centre slide, wrapped into [-half, n - half)
          let offset = (((i - active) % n) + n) % n;
          if (offset >= n - half) offset -= n;
          const pos = Math.max(-2, Math.min(2, offset));
          const isCenter = offset === 0;
          const isSide = Math.abs(offset) === 1;
          return (
            <div
              key={`${getKey(item)}-${i}`}
              className={`ep-slide ${isCenter ? "is-center" : ""} ${isSide ? "is-side" : ""}`}
              style={cssVars({ "--pos": pos })}
              aria-hidden={!isCenter}
              onClick={isSide ? () => go(offset) : undefined}
            >
              {/* inert content so the side slide's click lands on the wrapper and centres it */}
              <div className="ep-slide-inner" inert={!isCenter}>
                {renderItem(item, i % items.length)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="ep-carousel-nav">
        <button
          type="button"
          className="ep-icon-btn"
          onClick={() => go(-1)}
          aria-label="Previous headliner"
        >
          <ArrowIcon className="ep-carousel-prev" />
        </button>
        <div className="ep-carousel-dots" role="tablist" aria-label="Choose headliner">
          {items.map((item, i) => (
            <button
              key={getKey(item)}
              type="button"
              role="tab"
              aria-selected={i === realIndex}
              aria-label={`Show headliner ${i + 1} of ${items.length}`}
              className={`ep-carousel-dot ${i === realIndex ? "is-active" : ""}`}
              onClick={() => go(i - realIndex)}
            >
              {i === realIndex && running && (
                <span
                  key={active}
                  className="ep-carousel-dot-fill"
                  style={{ animationDuration: `${AUTOPLAY_MS}ms` }}
                />
              )}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="ep-icon-btn"
          onClick={() => go(1)}
          aria-label="Next headliner"
        >
          <ArrowIcon />
        </button>
      </div>
    </div>
  );
}
