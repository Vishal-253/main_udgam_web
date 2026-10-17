import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  // the loader stays until the 3D scene has loaded and drawn its first frames
  const [sceneReady, setSceneReady] = useState(false);
  const [loadProgress, setLoadProgress] = useState<number | null>(null);
  const [minTimePassed, setMinTimePassed] = useState(false);
  const loading = !(sceneReady && minTimePassed);
  // High quality by default on every device; the button bottom-right switches to Low quality
  const [low, setLow] = useState(false);

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
  const onLoadProgress = useCallback((p: number) => setLoadProgress(p), []);

  // buttons inside the 3D scene (drei <Html> has no router context) ask for in-app navigation
  const navigate = useNavigate();
  useEffect(() => {
    const go = (e: Event) => {
      const to = (e as CustomEvent<string>).detail;
      if (to === "/events" || to === "/merch") void navigate({ to });
    };
    window.addEventListener("udgam:navigate", go);
    return () => window.removeEventListener("udgam:navigate", go);
  }, [navigate]);

  // scroll position drives the 3D camera; a ref (not React state), so scrolling never re-renders
  useEffect(() => {
    const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
    const onScroll = () => {
      const max3d = (zoneRef.current?.offsetHeight ?? 0) - window.innerHeight;
      progress.current = max3d > 0 ? clamp(window.scrollY / max3d) : 0;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [loading]);

  return (
    <>
      <AnimatePresence>{loading && <BlossomLoader progress={loadProgress} />}</AnimatePresence>
      <div ref={canvasWrap} className="fixed inset-0 -z-0">
        <Suspense fallback={null}>
          <BlossomScene
            progress={progress}
            low={low}
            onLoadProgress={onLoadProgress}
            onReady={onSceneReady}
          />
        </Suspense>
      </div>
      <button onClick={() => setLow(!low)} className="glass fixed bottom-5 right-5 z-40 rounded-full px-4 py-2 text-xs font-bold text-secondary-foreground">
        {low ? "Low quality ✓" : "High quality ✓"}
      </button>

      {/* click-through: this layer only provides scroll height + the title, so clicks reach
          the 3D scene's buttons (Register for Events, Shop Merch) underneath */}
      <main className="pointer-events-none relative z-10">
        <div ref={zoneRef}>
        <section className="relative flex h-screen flex-col items-center justify-center px-5 text-center select-none">
          {/* Modern Impressive Udgam 2K26 Title */}
          <motion.h1
            initial={{ opacity: 0, y: 30, scale: 0.94 }}
            animate={loading ? {} : { opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            className="font-['Outfit',sans-serif] text-7xl sm:text-8xl md:text-9xl lg:text-[11rem] font-black tracking-[-0.03em] leading-none pb-[0.14em]"
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

        {/* scroll room for the 3D journey */}
        <div className="h-[300vh]" />
        </div>

      </main>
    </>
  );
}
