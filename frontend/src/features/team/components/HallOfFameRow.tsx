import { Children, useRef, useEffect, useCallback, useState, type ReactNode } from "react";

const SWIPE_QUERY = "(hover: none) and (pointer: coarse)";

/**
 * HallOfFameRow
 * A single horizontal row of items walked past like a gallery wall.
 *
 * Desktop ("pinned"): the row stays pinned in the middle of the screen while the page
 * scrolls vertically; vertical scroll progress drives the row sideways until its end,
 * then the page continues normally (and reverses the same way going up).
 *
 * Touch devices ("swipe"): the page scrolls normally and the row is a native horizontal
 * swipe carousel that snaps each item to the centre.
 *
 * In both modes the per-item depth follows the row's position. An optional `heading`
 * is rendered inside the pinned area so the title and row stay together.
 */
export default function HallOfFameRow({
  children,
  heading = null,
  label = "Committees",
}: {
  children: ReactNode;
  heading?: ReactNode;
  label?: string;
}) {
  // pinned on the server and first client render; switches to swipe on touch devices after mount
  const [swipeMode, setSwipeMode] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [hasSwiped, setHasSwiped] = useState(false);

  const pinRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  const travelRef = useRef(0);
  const activeRef = useRef(0);
  // layout cache, refreshed only on resize: item centres (track coordinates) and the last
  // depth written to each item, so scrolling never forces a layout read
  const centersRef = useRef<number[]>([]);
  const lastDepthRef = useRef<number[]>([]);
  const viewWidthRef = useRef(0);

  const count = Children.count(children);

  useEffect(() => {
    const mq = window.matchMedia(SWIPE_QUERY);
    const onChange = () => setSwipeMode(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  /** Caches each item's centre. offsetLeft ignores the items' 3D transforms, unlike getBoundingClientRect. */
  const cacheLayout = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const items = Array.from(track.children as HTMLCollectionOf<HTMLElement>);
    centersRef.current = items.map((item) => item.offsetLeft + item.offsetWidth / 2);
    lastDepthRef.current = items.map(() => NaN);
    viewWidthRef.current = track.clientWidth;
  }, []);

  // Per-item depth from the row's horizontal position: arithmetic only, writes only on change.
  const applyDepth = useCallback((scrollLeft: number) => {
    const track = trackRef.current;
    if (!track) return;
    const items = track.children as HTMLCollectionOf<HTMLElement>;
    const centers = centersRef.current;
    const last = lastDepthRef.current;
    const viewCenter = scrollLeft + viewWidthRef.current / 2;
    const reach = Math.max(1, viewWidthRef.current * 0.55);
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const center = centers[i] ?? 0;
      const offset = center - viewCenter;
      const d = Math.round(Math.max(-1.6, Math.min(1.6, offset / reach)) * 1000) / 1000;
      if (d !== last[i]) {
        last[i] = d;
        items[i]?.style.setProperty("--hof-d", String(d));
      }
      if (Math.abs(offset) < nearestDist) {
        nearestDist = Math.abs(offset);
        nearest = i;
      }
    }
    if (nearest !== activeRef.current) {
      activeRef.current = nearest;
      setActiveIndex(nearest);
    }
  }, []);

  const update = useCallback(() => {
    frameRef.current = 0;
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !galleryRef.current || !track) return;

    if (swipeMode) {
      applyDepth(track.scrollLeft);
      return;
    }

    // read first (one layout read), then write: no layout thrashing while scrolling
    const progress = Math.min(Math.max(-pin.getBoundingClientRect().top, 0), travelRef.current);
    track.scrollLeft = progress;
    applyDepth(progress);
  }, [swipeMode, applyDepth]);

  const schedule = useCallback(() => {
    if (!frameRef.current) frameRef.current = requestAnimationFrame(update);
  }, [update]);

  const measure = useCallback(() => {
    const pin = pinRef.current;
    const track = trackRef.current;
    if (!pin || !track) return;
    if (swipeMode) {
      pin.style.height = "";
    } else {
      travelRef.current = Math.max(track.scrollWidth - track.clientWidth, 0);
      // pinned for exactly as long as the row needs to travel
      pin.style.height = `${window.innerHeight + travelRef.current}px`;
    }
    cacheLayout();
    schedule();
  }, [swipeMode, schedule, cacheLayout]);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return undefined;
    travelRef.current = 0;
    measure();

    const onTrackScroll = () => {
      // ignore the scroll event browsers fire while laying out the snap points
      if (track.scrollLeft > 10) setHasSwiped(true);
      schedule();
    };
    if (swipeMode) {
      track.addEventListener("scroll", onTrackScroll, { passive: true });
    } else {
      track.scrollLeft = 0;
      window.addEventListener("scroll", schedule, { passive: true });
    }
    window.addEventListener("resize", measure);
    // images / fonts can change the row width after mount
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    Array.from(track.children).forEach((item) => ro.observe(item));
    void document.fonts.ready.then(measure);

    return () => {
      track.removeEventListener("scroll", onTrackScroll);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
    };
  }, [swipeMode, measure, schedule]);

  return (
    <div className={`hof-pin ${swipeMode ? "hof-mode-swipe" : "hof-mode-pinned"}`} ref={pinRef}>
      <div className="hof-sticky">
        {heading && <div className="hof-heading">{heading}</div>}
        <div className="hof-gallery" ref={galleryRef}>
          <div className="hof-track" ref={trackRef} role="region" aria-label={label}>
            {Children.map(children, (child) => (
              <div className="hof-item">{child}</div>
            ))}
          </div>

          {swipeMode && count > 1 && (
            <div className="hof-swipe-hint" aria-hidden="true">
              <span className={`hof-swipe-cue ${hasSwiped ? "is-faded" : ""}`}>
                <span className="hof-swipe-arrow">‹</span> Swipe{" "}
                <span className="hof-swipe-arrow">›</span>
              </span>
              <span className="hof-swipe-count">
                {activeIndex + 1} / {count}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
