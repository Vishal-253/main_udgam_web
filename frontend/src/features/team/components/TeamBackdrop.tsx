import { useEffect, useRef } from "react";
import { cssVars } from "@/lib/css-vars";

const PANORAMA = "/assets/team/backgrounds/team-panorama";

// How far down the panorama the scene has travelled when the side-scrolling
// committee row pins. It holds there while the row scrolls sideways, and the
// rest of the panorama plays out after the row, down to the footer.
const HOLD_AT = 0.86;

// spread out deterministically so the layout is stable between renders
const PETALS = Array.from({ length: 14 }, (_, i) =>
  cssVars({
    "--x": `${(i * 37) % 100}%`,
    "--size": `${10 + ((i * 5) % 9)}px`,
    "--blur": `${(i % 3) * 0.6}px`,
    "--fall": `${13 + ((i * 7) % 9)}s`,
    "--sway": `${3.2 + (i % 4) * 0.7}s`,
    "--delay": `${i * -1.9}s`,
  }),
);

/**
 * Fixed landscape behind the team page: one tall panorama (blossom sky, peaks,
 * lake, meadow) that slides up continuously as the page scrolls, far slower than
 * the content, so the page reads as walking down through one scene. It stands
 * still while the organising committee row scrolls sideways.
 * Foreground petals drift in front and get pushed by the scroll for extra depth.
 */
export default function TeamBackdrop() {
  const stageRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const img = imgRef.current;
    if (!stage || !img) return undefined;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let travel = 0;
    let holdStart = 0; // scroll position where the committee row pins
    let holdEnd = 0; // ...and where it lets go
    let lastScroll = window.scrollY;
    let wind = 0; // petals get pushed against the scroll direction, then drift back
    let frame = 0;

    const measure = () => {
      // the frame is a little larger than the viewport (room for the pointer lean)
      travel = Math.max(
        0,
        img.offsetHeight - (img.parentElement?.offsetHeight ?? window.innerHeight),
      );
      const pin = document.querySelector<HTMLElement>(".udgam-team .hof-pin");
      if (pin) {
        const top = pin.getBoundingClientRect().top + window.scrollY;
        holdStart = top;
        // pinned row: still for the whole sideways travel; swipe row (phones): no hold
        holdEnd = Math.max(top, top + pin.offsetHeight - window.innerHeight);
      } else {
        holdStart = holdEnd = Infinity;
      }
    };

    const progressAt = (y: number, max: number) => {
      if (max <= 0) return 0;
      const start = Math.min(holdStart, max);
      const end = Math.min(holdEnd, max);
      if (y <= start) return start > 0 ? (y / start) * HOLD_AT : HOLD_AT;
      if (y <= end) return HOLD_AT;
      return end < max ? HOLD_AT + ((y - end) / (max - end)) * (1 - HOLD_AT) : 1;
    };

    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(1, Math.max(0, progressAt(window.scrollY, max)));
      stage.style.setProperty("--shift", `${(-progress * travel).toFixed(1)}px`);

      if (!reduced) {
        const dy = window.scrollY - lastScroll;
        lastScroll = window.scrollY;
        wind = Math.max(-160, Math.min(160, wind * 0.9 - dy * 0.35));
        stage.style.setProperty("--wind", `${wind.toFixed(1)}px`);
        if (Math.abs(wind) > 0.5) schedule();
      }

      if (finePointer && !reduced) {
        pointer.x += (pointer.tx - pointer.x) * 0.08;
        pointer.y += (pointer.ty - pointer.y) * 0.08;
        stage.style.setProperty("--mx", pointer.x.toFixed(4));
        stage.style.setProperty("--my", pointer.y.toFixed(4));
        if (Math.abs(pointer.tx - pointer.x) > 0.001 || Math.abs(pointer.ty - pointer.y) > 0.001)
          schedule();
      }
    };

    function schedule() {
      if (!frame) frame = requestAnimationFrame(update);
    }
    const onResize = () => {
      measure();
      schedule();
    };
    const onPointer = (e: PointerEvent) => {
      pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      schedule();
    };

    measure();
    update();

    // the image's height settles once it loads; the page height changes as sections settle
    const ro = new ResizeObserver(onResize);
    ro.observe(img);
    ro.observe(document.body);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", onResize);
    if (finePointer) window.addEventListener("pointermove", onPointer, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      frame = 0;
      ro.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", onResize);
      window.removeEventListener("pointermove", onPointer);
    };
  }, []);

  return (
    <div className="team-backdrop" ref={stageRef} aria-hidden="true">
      <div className="tb-world">
        <img
          ref={imgRef}
          className="tb-panorama"
          src={`${PANORAMA}-1280.webp`}
          srcSet={`${PANORAMA}-1280.webp 1280w, ${PANORAMA}-2560.webp 2560w`}
          sizes="max(100vw, 95vh)"
          alt=""
          decoding="async"
          fetchPriority="high"
        />
      </div>
      <div className="tb-veil" />
      {/* foreground petals: closer than the scenery, so they catch the scroll wind */}
      <div className="tb-petals">
        {PETALS.map((style, i) => (
          <span key={i} className="tb-petal" style={style} />
        ))}
      </div>
    </div>
  );
}
