import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BlossomLoader } from "@/components/ui/BlossomLoader";
import campusImg from "@/assets/floating_campus.png";

const BlossomScene = lazy(() => import("@/components/3d/BlossomScene").then((m) => ({ default: m.BlossomScene })));

export const Route = createFileRoute("/")({
  ssr: false,
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



const PETALS = Array.from({ length: 30 }, (_, i) => {
  const r = (n: number) => { const x = Math.sin(i * 12.9898 + n * 78.233) * 43758.5453; return x - Math.floor(x); };
  return { left: r(1) * 100, size: 12 + r(2) * 20, dur: 6 + r(3) * 6, delay: -r(4) * 10, dx: (r(5) - 0.3) * 25 };
});

function Home() {
  const progress = useRef(0);
  const zoneRef = useRef<HTMLDivElement>(null);
  const canvasWrap = useRef<HTMLDivElement>(null);
  const videoSec = useRef<HTMLElement>(null);
  const videoEl = useRef<HTMLVideoElement>(null);
  const videoWrap = useRef<HTMLDivElement>(null); // video layer (opacity)
  const veilEl = useRef<HTMLDivElement>(null);
  const petalEl = useRef<HTMLDivElement>(null);
  const videoTarget = useRef(0); // 0..1
  const [loading, setLoading] = useState(true);
  const [low, setLow] = useState(false);
  const [enterKey, setEnterKey] = useState(0); // +1 on every "Enter Campus" click
  const entered = enterKey > 0;

  // once the video section exists, glide the page down into it (the cross-fade plays on the way)
  useEffect(() => {
    if (enterKey === 0) return;
    const zoneH = zoneRef.current?.offsetHeight ?? 0;
    const target = zoneH + window.innerHeight * 0.05;
    const from = window.scrollY;
    const dur = Math.min(Math.max(Math.abs(target - from) / 1.2, 1800), 3200);
    const t0 = performance.now();
    let raf = 0;
    const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
    const step = (now: number) => {
      const t = Math.min((now - t0) / dur, 1);
      window.scrollTo({ top: from + (target - from) * ease(t), behavior: "instant" as ScrollBehavior });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stop = () => cancelAnimationFrame(raf); // user takes over
    window.addEventListener("wheel", stop, { passive: true, once: true });
    window.addEventListener("touchstart", stop, { passive: true, once: true });
    return () => {
      stop();
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    };
  }, [enterKey]);

  useEffect(() => {
    const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
    const onScroll = () => {
      const vh = window.innerHeight;
      const zoneH = zoneRef.current?.offsetHeight ?? 0;
      const sectionH = videoSec.current?.offsetHeight ?? 0;
      // 3D journey = scroll range of the first block only
      const max3d = zoneH - vh;
      progress.current = max3d > 0 ? clamp(window.scrollY / max3d) : 0;
      // transition: f = fade-in (last screen of 3D), g = pink afterglow (first 1.2 screens of video)
      const sm = (t: number) => { const c = clamp(t); return c * c * (3 - 2 * c); };
      const f = clamp((window.scrollY - (zoneH - vh)) / vh);
      const g = clamp((window.scrollY - zoneH) / (vh * 0.7));
      const eased = sm(f);
      // pink veil: washes in, then thins, then melts away over the first part of the video
      const veil = f < 0.5 ? 0.9 * sm(f / 0.5) : f < 1 ? 0.9 - 0.78 * sm((f - 0.5) / 0.5) : 0.12 * (1 - sm(g));
      if (videoWrap.current) {
        videoWrap.current.style.opacity = String(eased);
        videoWrap.current.style.transform = `scale(${1.12 - 0.12 * eased})`;
      }
      if (veilEl.current) veilEl.current.style.opacity = String(veil);
      if (petalEl.current) petalEl.current.style.opacity = String(sm(f) * (1 - sm(g)));
      // video scrub starts once the fade is complete
      const maxV = sectionH - 2 * vh;
      videoTarget.current = maxV > 0 ? clamp((window.scrollY - zoneH) / maxV) : 0;
      // stop rendering the canvas once the video fully covers it
      if (canvasWrap.current) canvasWrap.current.style.visibility = f >= 1 ? "hidden" : "visible";
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [loading, entered]);

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
  }, [entered]);

  return (
    <>
      <AnimatePresence>{loading && <BlossomLoader onDone={() => setLoading(false)} />}</AnimatePresence>
      <div ref={canvasWrap} className="fixed inset-0 -z-0">
        <Suspense fallback={null}><BlossomScene progress={progress} low={low} /></Suspense>
      </div>
      <button onClick={() => setLow(!low)} className="glass fixed bottom-5 right-5 z-40 rounded-full px-4 py-2 text-xs font-bold text-secondary-foreground">
        {low ? "Low quality ✓" : "High quality ✓"}
      </button>

      <main className="relative z-10">
        <div ref={zoneRef}>
        <section className="flex h-screen flex-col items-center justify-center px-5 text-center">
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: loading ? 0 : 1 }} transition={{ delay: 0.2 }} className="tracking-[0.5em] text-secondary-foreground">COLLEGE FEST</motion.p>
          <motion.h1 initial={{ opacity: 0, y: 40 }} animate={loading ? {} : { opacity: 1, y: 0 }} transition={{ duration: 1 }} className="mt-3 text-7xl font-semibold text-gradient drop-shadow md:text-9xl">Udgam 2K26</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={loading ? {} : { opacity: 1 }} transition={{ delay: 0.5 }} className="mt-4 text-xl italic text-secondary-foreground font-display">Where dreams bloom.</motion.p>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={loading ? {} : { opacity: 1, y: 0 }} transition={{ delay: 0.8 }} className="mt-10 flex flex-wrap justify-center gap-3">
            <Cta to="/events" primary>Explore Events</Cta>
            <Cta to="/calendar">View Calendar</Cta>
            <Cta to="/merch">Get Merch</Cta>
          </motion.div>
          <motion.span animate={{ y: [0, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }} className="absolute bottom-10 text-sm text-secondary-foreground">scroll into the grove ↓</motion.span>
        </section>

        <div className="h-[200vh]" />

        <section className="flex h-screen flex-col items-center justify-center px-5 text-center">
          <motion.h2 initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8 }} className="text-4xl font-semibold text-gradient md:text-6xl">See you in the canopy</motion.h2>

          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.8 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ amount: 0.4 }}
            transition={{ type: "spring", stiffness: 70, damping: 14, delay: 0.15 }}
            className="glass mt-8 flex w-full max-w-md flex-col items-center rounded-[2rem] px-6 pb-7 pt-6"
          >
            <h3 className="text-2xl font-bold text-secondary-foreground">Explore NIT Sikkim</h3>
            <p className="mt-1 text-sm text-secondary-foreground/80">The official venue for Udgam 2K26</p>
            <motion.img
              src={campusImg}
              alt="NIT Sikkim campus"
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
              className="mt-4 max-h-[26vh] w-auto drop-shadow-2xl"
            />
            <motion.button
              onClick={() => setEnterKey((k) => k + 1)}
              whileHover={{ scale: 1.07 }}
              whileTap={{ scale: 0.95 }}
              animate={{ boxShadow: ["0 0 0 0 rgba(236,100,150,0.55)", "0 0 0 18px rgba(236,100,150,0)"] }}
              transition={{ boxShadow: { repeat: Infinity, duration: 1.8 } }}
              className="btn-blossom mt-5 rounded-full px-8 py-3 font-bold"
            >
              Enter Campus →
            </motion.button>
          </motion.div>
          <div className="mt-5"><Cta to="/about">About Udgam</Cta></div>
        </section>
        </div>

        {/* Campus walkthrough: scroll = move forward from main gate to football ground */}
        {entered && (
        <section ref={videoSec} className="pointer-events-none relative h-[600vh]" style={{ marginTop: "-100vh" }}>
          <style>{`
            @keyframes udgamPetalFall {
              0% { transform: translate3d(0, -12vh, 0) rotate(0deg); }
              50% { transform: translate3d(calc(var(--dx) * 0.5), 55vh, 0) rotate(200deg); }
              100% { transform: translate3d(var(--dx), 112vh, 0) rotate(420deg); }
            }
          `}</style>
          <div className="sticky top-0 h-screen w-full overflow-hidden">
            {/* video layer */}
            <div ref={videoWrap} className="absolute inset-0" style={{ opacity: 0, transform: "scale(1.12)", willChange: "opacity, transform" }}>
              <video
                ref={videoEl}
                src="/campus.mp4"
                muted
                playsInline
                preload="auto"
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
            {/* pink veil used to blend the 3D grove into the video */}
            <div
              ref={veilEl}
              className="absolute inset-0"
              style={{ opacity: 0, background: "radial-gradient(ellipse at 50% 40%, #fff0f5 0%, #fbcfe0 55%, #f7b6cf 100%)" }}
            />
            {/* falling petals over the transition */}
            <div ref={petalEl} className="absolute inset-0 overflow-hidden" style={{ opacity: 0 }}>
              {PETALS.map((p, i) => (
                <span
                  key={i}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: `${p.left}%`,
                    width: p.size,
                    height: p.size * 0.72,
                    borderRadius: "150% 0 150% 0",
                    background: "linear-gradient(135deg, #ffd1e0, #f58fb4)",
                    boxShadow: "0 0 8px rgba(255,150,190,0.6)",
                    animation: `udgamPetalFall ${p.dur}s linear ${p.delay}s infinite`,
                    ["--dx" as string]: `${p.dx}vw`,
                  }}
                />
              ))}
            </div>
          </div>
        </section>
        )}
      </main>
    </>
  );
}

function Cta({ to, children, primary }: { to: "/events" | "/calendar" | "/merch" | "/about"; children: React.ReactNode; primary?: boolean }) {
  return (
    <motion.div whileHover={{ scale: 1.07 }} whileTap={{ scale: 0.95 }}>
      <Link to={to} className={`block rounded-full px-7 py-3 font-bold ${primary ? "btn-blossom" : "glass text-secondary-foreground"}`}>{children}</Link>
    </motion.div>
  );
}