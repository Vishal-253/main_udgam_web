import { createFileRoute } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { BlossomLoader, LoaderScreen } from "@/components/ui/BlossomLoader";

// start downloading the 3D scene as soon as this route's code runs, not when Home first renders
const sceneImport = import("@/components/3d/BlossomScene");
const BlossomScene = lazy(() => sceneImport.then((m) => ({ default: m.BlossomScene })));

/** Never keep visitors on the loader longer than this, even if a texture is slow. */
const MAX_LOADER_MS = 12_000;
/** Keep the loader up at least this long so it doesn't flash. */
const MIN_LOADER_MS = 700;

export const Route = createFileRoute("/")({
  ssr: false,
  // ssr:false routes render this in the very first HTML, so the loader shows before any JS loads
  pendingComponent: () => <LoaderScreen />,
  head: () => ({
    meta: [
      { title: "Udgam 2K26 — Where Dreams Bloom" },
      { name: "description", content: "Step into a 3D cherry blossom forest and explore Udgam 2K26, our college fest." },
      { property: "og:title", content: "Udgam 2K26 — Where Dreams Bloom" },
      { property: "og:description", content: "A whimsical cherry blossom college fest experience." },
    ],
  }),
  component: Home,
});



function Home() {
  const progress = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const videoSec = useRef<HTMLElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const videoWrap = useRef<HTMLDivElement>(null); // video layer (shown only at the very end)
  const videoTarget = useRef(0); // 0..1
  // the loader stays until the 3D scene has loaded and drawn its first frames
  const [sceneReady, setSceneReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const loading = !(sceneReady && minTimePassed);
  // Start in low quality on phones / low-core or low-memory devices (user can still toggle)
  const [low, setLow] = useState(() => {
    if (typeof window === "undefined") return false;
    const nav = navigator as Navigator & { deviceMemory?: number };
    const coarse = window.matchMedia?.("(pointer: coarse)").matches ?? false;
    return coarse || (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
  });
  const [scenePaused, setScenePaused] = useState(false);

  useEffect(() => {
    const min = setTimeout(() => setMinTimePassed(true), MIN_LOADER_MS);
    // safety net: a stalled texture must never trap visitors on the loader
    const max = setTimeout(() => setSceneReady(true), MAX_LOADER_MS);
    return () => {
      clearTimeout(min);
      clearTimeout(max);
    };
  }, []);
  const onSceneReady = useCallback(() => setSceneReady(true), []);
  // reloaded while already at the campus: the 3D scene is hidden and paused (so it can't signal
  // "ready"), and there's nothing to wait for — drop the loader right away
  useEffect(() => {
    if (scenePaused) setSceneReady(true);
  }, [scenePaused]);
  const onLoadProgress = useCallback((p: number) => setLoadProgress(p), []);

  useEffect(() => {
    const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
    let videoPrimed = false;
    const onScroll = () => {
      const vh = window.innerHeight;
      const zoneH = zoneRef.current?.offsetHeight ?? 0;
      const sectionH = videoSec.current?.offsetHeight ?? 0;
      // 3D journey = scroll range of the first block only
      const max3d = zoneH - vh;
      const p = max3d > 0 ? clamp(window.scrollY / max3d) : 0;
      progress.current = p;
      // start fetching the campus video only once the visitor is well into the journey
      if (!videoPrimed && p > 0.5 && videoEl.current) {
        videoPrimed = true;
        videoEl.current.preload = "auto";
      }
      // the campus appears only at the VERY end of the 3D journey (no cross-fade)
      const atEnd = max3d > 0 && window.scrollY >= max3d - 1;
      if (videoWrap.current) videoWrap.current.style.visibility = atEnd ? "visible" : "hidden";
      // scrubbing runs over the campus section, starting exactly at the end of the journey
      const maxV = sectionH - vh;
      videoTarget.current = atEnd && maxV > 0 ? clamp((window.scrollY - max3d) / maxV) : 0;
      // the video covers the canvas from here on: hide it and stop the WebGL render loop
      if (canvasWrap.current) canvasWrap.current.style.visibility = atEnd ? "hidden" : "visible";
      setScenePaused(atEnd);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [loading]);

  // Scroll-scrubbed video: ease currentTime toward the scroll position
  useEffect(() => {
    const v = videoEl.current;
    if (!v) return;
    v.pause();
    let raf = 0;
    let cur = 0;
    const tick = () => {
      if (v.duration && isFinite(v.duration)) {
        const target = videoTarget.current * (v.duration - 0.05);
        cur += (target - cur) * 0.12;
        if (Math.abs(v.currentTime - cur) > 0.03 && !v.seeking) v.currentTime = cur;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <>
      <AnimatePresence>{loading && <BlossomLoader progress={loadProgress} />}</AnimatePresence>
      <div ref={canvasWrap} className="fixed inset-0 -z-0">
        <Suspense fallback={null}>
          <BlossomScene
            progress={progress}
            low={low}
            paused={scenePaused}
            onLoadProgress={onLoadProgress}
            onReady={onSceneReady}
          />
        </Suspense>
      </div>
      <button onClick={() => setLow(!low)} className="glass fixed bottom-5 right-5 z-40 rounded-full px-4 py-2 text-xs font-bold text-secondary-foreground">
        {low ? "Low quality ✓" : "High quality ✓"}
      </button>

      <main className="relative z-10">
        <div ref={zoneRef}>
        <section className="relative flex h-screen flex-col items-center justify-center px-5 text-center select-none">
          {/* Modern Impressive Udgam 2K26 Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={loading ? {} : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-['Outfit',sans-serif] text-7xl sm:text-8xl md:text-9xl lg:text-[11rem] font-black tracking-[-0.03em] leading-none"
            style={{
              background: 'linear-gradient(180deg, #ffffff 15%, #ffe6f0 45%, #ff5c87 78%, #d81b4b 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 10px 28px rgba(216, 27, 75, 0.35))',
            }}
          >
            Udgam 2K26
          </motion.h1>

          {/* Clean Minimalist Floating Scroll Indicator */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={loading ? {} : { opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="absolute bottom-10 flex flex-col items-center gap-1.5 pointer-events-none"
          >
            <motion.div
              animate={{ y: [0, 6, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="flex items-center gap-2 rounded-full border border-white/50 bg-white/20 px-4 py-1.5 shadow-[0_2px_12px_rgba(216,27,75,0.15)] backdrop-blur-md"
            >
              <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-[#7a1c3e]">
                Scroll to explore
              </span>
              <span className="text-xs text-[#d81b4b]">↓</span>
            </motion.div>
          </motion.div>
        </section>

        {/* scroll room for the 3D journey; the campus starts right at its very end */}
        <div className="h-[300vh]" />
        </div>

        {/* Campus walkthrough: appears only at the very end of the 3D journey, then
            scrolling moves forward from the main gate to the football ground */}
        <section ref={videoSec} className="pointer-events-none relative h-[600vh]" style={{ marginTop: "-100vh" }}>
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            <div ref={videoWrap} className="absolute inset-0" style={{ visibility: "hidden" }}>
              <video
                ref={videoEl}
                src="/campus.mp4"
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
                style={{ filter: "saturate(1.05) brightness(1.02)" }}
              />
              {/* permanent soft cherry-blossom grade + pink vignette */}
              <div className="absolute inset-0" style={{ background: "rgba(255,170,205,0.04)", mixBlendMode: "soft-light" }} />
              <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse at center, rgba(255,200,222,0) 50%, rgba(240,120,165,0.12) 100%)" }} />
              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 rounded-full bg-pink-950/40 px-5 py-2 text-sm text-white backdrop-blur">
                Main Gate → Football Ground · keep scrolling
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
