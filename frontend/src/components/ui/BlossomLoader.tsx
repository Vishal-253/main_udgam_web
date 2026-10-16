import { motion } from "framer-motion";

// Udgam loading screen.
//
// <LoaderScreen> is plain markup + CSS (no JavaScript needed), so the home route also uses it as
// its pendingComponent: TanStack Start puts it in the very first HTML response and it shows
// instantly, before any script has downloaded. When React takes over, <BlossomLoader> renders
// the exact same screen (so the hand-off is invisible), shows real loading progress, and fades
// out only once the 3D scene is ready.

const CSS = `
.udgam-loader{position:fixed;inset:0;z-index:100;display:flex;align-items:center;justify-content:center;overflow:hidden;
  background:linear-gradient(135deg,#fff0f5 0%,#fce4ef 50%,#fbd4e9 100%);font-family:"Quicksand",system-ui,sans-serif}
.udgam-loader__petal{position:absolute;border-radius:150% 0 150% 0;pointer-events:none;
  background:linear-gradient(135deg,rgba(255,180,210,.4),rgba(245,143,180,.25));animation:udgamLoaderFloat 3.4s ease-in-out infinite}
.udgam-loader__inner{position:relative;display:flex;flex-direction:column;align-items:center;gap:24px}
.udgam-loader__logo{position:relative;width:120px;height:120px;animation:udgamLoaderBob 2.4s ease-in-out infinite}
.udgam-loader__logo::before{content:"";position:absolute;inset:-24px;border-radius:50%;
  background:radial-gradient(circle,rgba(236,100,150,.35) 0%,transparent 70%);filter:blur(18px);animation:udgamLoaderGlow 2s ease-in-out infinite}
.udgam-loader__logo img{position:relative;width:120px;height:120px;object-fit:contain;filter:drop-shadow(0 8px 24px rgba(220,80,130,.45))}
.udgam-loader__title{margin:0;text-align:center;font-family:"Fraunces",Georgia,serif;font-size:clamp(3.4rem,9vw,4.6rem);line-height:1;
  background:linear-gradient(135deg,#c2185b,#f08a6b);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.udgam-loader__year{margin:6px 0 0;text-align:center;letter-spacing:.5em;color:#8a6070;font-size:14px}
.udgam-loader__bar{position:relative;width:160px;height:3px;margin-top:4px;border-radius:99px;background:rgba(220,130,170,.2);overflow:hidden}
.udgam-loader__fill{height:100%;border-radius:99px;background:linear-gradient(90deg,#e0457b,#f08a6b);transition:width .35s ease}
.udgam-loader__fill--indeterminate{width:40%;animation:udgamLoaderSlide 1.2s ease-in-out infinite}
.udgam-loader__status{margin:0;color:#8a6070;font-size:12px;letter-spacing:.08em;min-height:1em}
@keyframes udgamLoaderFloat{0%,100%{transform:translateY(0) rotate(0)}50%{transform:translateY(-10px) rotate(15deg)}}
@keyframes udgamLoaderBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes udgamLoaderGlow{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes udgamLoaderSlide{0%{transform:translateX(-110%)}100%{transform:translateX(260%)}}
@media (prefers-reduced-motion:reduce){.udgam-loader *{animation:none!important}}
`;

const PETALS = Array.from({ length: 8 }, (_, i) => {
  const size = 16 + (i % 3) * 8;
  return {
    top: `${10 + ((i * 11) % 80)}%`,
    left: `${5 + ((i * 13) % 90)}%`,
    width: size,
    height: size * 0.72,
    animationDelay: `${i * 0.2}s`,
    animationDuration: `${3 + i * 0.4}s`,
  };
});

/** The loading screen itself. `progress` 0..1 shows a real bar; null shows an indeterminate one. */
export function LoaderScreen({ progress = null }: { progress?: number | null }) {
  const pct = progress === null ? null : Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  return (
    <div className="udgam-loader" role="status" aria-live="polite" aria-label="Loading Udgam 2K26">
      <style>{CSS}</style>
      {PETALS.map((p, i) => (
        <span key={i} className="udgam-loader__petal" style={p} />
      ))}
      <div className="udgam-loader__inner">
        <div className="udgam-loader__logo">
          <img src="/favicon.ico" alt="" width={120} height={120} />
        </div>
        <div>
          <p className="udgam-loader__title">Udgam</p>
          <p className="udgam-loader__year">2K26</p>
        </div>
        <div className="udgam-loader__bar">
          <div
            className={`udgam-loader__fill ${pct === null ? "udgam-loader__fill--indeterminate" : ""}`}
            style={pct === null ? undefined : { width: `${pct}%` }}
          />
        </div>
        <p className="udgam-loader__status">{pct === null ? "Loading…" : `Growing the forest… ${pct}%`}</p>
      </div>
    </div>
  );
}

/** React-side loader: same screen, fades out when removed (wrap in <AnimatePresence>). */
export function BlossomLoader({ progress }: { progress: number | null }) {
  return (
    <motion.div
      className="fixed inset-0 z-[100]"
      initial={false}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
    >
      <LoaderScreen progress={progress} />
    </motion.div>
  );
}
