import { useState, useEffect, useRef, useCallback, useMemo, type MouseEvent } from "react";
import { cssVars } from "@/lib/css-vars";
import type { TeamMember } from "../data/teamData";
import { subscribeTilt } from "../lib/deviceTilt";
import { teamPhotoFor } from "../lib/teamPhotos";

const ANIMATION_CONFIG = {
  INITIAL_DURATION: 1200,
  INITIAL_X_OFFSET: 70,
  INITIAL_Y_OFFSET: 60,
  ENTER_TRANSITION_MS: 180,
};

const CHECK = (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

// Phone numbers are placeholders for now; flip to true once the real ones are in teamData.
const SHOW_PHONE = false;

// Maximum card rotation (degrees) at the card edge / full phone tilt.
const MAX_ROTATE_X = 18;
const MAX_ROTATE_Y = 16;

const clamp = (v: number, min = 0, max = 100) => Math.min(Math.max(v, min), max);
const round = (v: number, precision = 3) => parseFloat(v.toFixed(precision));
const adjust = (v: number, fMin: number, fMax: number, tMin: number, tMax: number) =>
  round(tMin + ((tMax - tMin) * (v - fMin)) / (fMax - fMin));

/**
 * TeamPassCard
 * Integrates the physics-based 3D tilt engine, dynamic surface glare, and cursor-following
 * behind-glow from React Bits while preserving 100% of the authentic festival ID badge pass design.
 */
export default function TeamPassCard({
  member,
  festTag = "CREW · UDGAM '26",
  hideRoleInside = false,
  enableTilt = true,
  enableMobileTilt = true,
  behindGlowEnabled = true,
  behindGlowColor = "rgba(245, 183, 41, 0.42)",
  behindGlowSize = "55%",
  className = "",
}: {
  member: TeamMember;
  festTag?: string;
  hideRoleInside?: boolean;
  enableTilt?: boolean;
  enableMobileTilt?: boolean;
  behindGlowEnabled?: boolean;
  behindGlowColor?: string;
  behindGlowSize?: string;
  className?: string;
}) {
  const [imageError, setImageError] = useState(false);
  const [copied, setCopied] = useState<"phone" | "email" | null>(null);

  const wrapRef = useRef<HTMLDivElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const enterTimerRef = useRef<number | null>(null);
  const leaveRafRef = useRef<number | null>(null);

  // Physics-based 3D Tilt Engine with smooth exponential damping
  const tiltEngine = useMemo(() => {
    if (!enableTilt) return null;

    let rafId: number | null = null;
    let running = false;
    let lastTs = 0;

    let currentX = 0;
    let currentY = 0;
    let targetX = 0;
    let targetY = 0;

    const DEFAULT_TAU = 0.14;
    const INITIAL_TAU = 0.6;
    let initialUntil = 0;

    const setVarsFromXY = (x: number, y: number) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap) return;

      const width = shell.clientWidth || 1;
      const height = shell.clientHeight || 1;

      const percentX = clamp((100 / width) * x);
      const percentY = clamp((100 / height) * y);

      const centerX = percentX - 50;
      const centerY = percentY - 50;

      const properties: Record<string, string> = {
        "--pointer-x": `${percentX}%`,
        "--pointer-y": `${percentY}%`,
        "--background-x": `${adjust(percentX, 0, 100, 35, 65)}%`,
        "--background-y": `${adjust(percentY, 0, 100, 35, 65)}%`,
        "--pointer-from-center": `${clamp(Math.hypot(percentY - 50, percentX - 50) / 50, 0, 1)}`,
        "--pointer-from-top": `${percentY / 100}`,
        "--pointer-from-left": `${percentX / 100}`,
        "--rotate-x": `${round(-(centerX / 50) * MAX_ROTATE_X)}deg`,
        "--rotate-y": `${round((centerY / 50) * MAX_ROTATE_Y)}deg`,
      };

      for (const [k, v] of Object.entries(properties)) {
        wrap.style.setProperty(k, v);
      }
    };

    const step = (ts: number) => {
      if (!running) return;
      if (lastTs === 0) lastTs = ts;
      const dt = (ts - lastTs) / 1000;
      lastTs = ts;

      const tau = ts < initialUntil ? INITIAL_TAU : DEFAULT_TAU;
      const k = 1 - Math.exp(-dt / tau);

      currentX += (targetX - currentX) * k;
      currentY += (targetY - currentY) * k;

      setVarsFromXY(currentX, currentY);

      const stillFar = Math.abs(targetX - currentX) > 0.05 || Math.abs(targetY - currentY) > 0.05;

      if (stillFar) {
        rafId = requestAnimationFrame(step);
      } else {
        running = false;
        lastTs = 0;
        if (rafId) {
          cancelAnimationFrame(rafId);
          rafId = null;
        }
      }
    };

    const start = () => {
      if (running) return;
      running = true;
      lastTs = 0;
      rafId = requestAnimationFrame(step);
    };

    const engine = {
      setImmediate(x: number, y: number) {
        currentX = x;
        currentY = y;
        setVarsFromXY(currentX, currentY);
      },
      setTarget(x: number, y: number) {
        targetX = x;
        targetY = y;
        start();
      },
      toCenter() {
        const shell = shellRef.current;
        if (!shell) return;
        engine.setTarget(shell.clientWidth / 2, shell.clientHeight / 2);
      },
      beginInitial(durationMs: number) {
        initialUntil = performance.now() + durationMs;
        start();
      },
      getCurrent() {
        return { x: currentX, y: currentY, tx: targetX, ty: targetY };
      },
      cancel() {
        if (rafId) cancelAnimationFrame(rafId);
        rafId = null;
        running = false;
        lastTs = 0;
      },
    };
    return engine;
  }, [enableTilt]);

  const getOffsets = (evt: PointerEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    return { x: evt.clientX - rect.left, y: evt.clientY - rect.top };
  };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      if (!shell || !tiltEngine || event.pointerType === "touch") return;
      const { x, y } = getOffsets(event, shell);
      tiltEngine.setTarget(x, y);
    },
    [tiltEngine],
  );

  const handlePointerEnter = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap || !tiltEngine || event.pointerType === "touch") return;

      wrap.classList.add("active");
      shell.classList.add("active");
      shell.classList.add("entering");
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      enterTimerRef.current = window.setTimeout(() => {
        shell.classList.remove("entering");
      }, ANIMATION_CONFIG.ENTER_TRANSITION_MS);

      const { x, y } = getOffsets(event, shell);
      tiltEngine.setTarget(x, y);
    },
    [tiltEngine],
  );

  const handlePointerLeave = useCallback(
    (event: PointerEvent) => {
      const shell = shellRef.current;
      const wrap = wrapRef.current;
      if (!shell || !wrap || !tiltEngine || event.pointerType === "touch") return;

      tiltEngine.toCenter();

      const checkSettle = () => {
        const { x, y, tx, ty } = tiltEngine.getCurrent();
        const settled = Math.hypot(tx - x, ty - y) < 0.6;
        if (settled) {
          shell.classList.remove("active");
          wrap.classList.remove("active");
          leaveRafRef.current = null;
        } else {
          leaveRafRef.current = requestAnimationFrame(checkSettle);
        }
      };
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
      leaveRafRef.current = requestAnimationFrame(checkSettle);
    },
    [tiltEngine],
  );

  useEffect(() => {
    if (!enableTilt || !tiltEngine) return;

    const shell = shellRef.current;
    if (!shell) return;

    const pointerMoveHandler = handlePointerMove;
    const pointerEnterHandler = handlePointerEnter;
    const pointerLeaveHandler = handlePointerLeave;

    shell.addEventListener("pointerenter", pointerEnterHandler);
    shell.addEventListener("pointermove", pointerMoveHandler);
    shell.addEventListener("pointerleave", pointerLeaveHandler);

    // intro "settle" tilt: desktop only — on phones every visible card animating at once on
    // page load is wasted work (they tilt with the gyroscope instead)
    const canHover = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (canHover && !reduced) {
      const initialX = (shell.clientWidth || 0) - ANIMATION_CONFIG.INITIAL_X_OFFSET;
      const initialY = ANIMATION_CONFIG.INITIAL_Y_OFFSET;
      tiltEngine.setImmediate(initialX, initialY);
      tiltEngine.toCenter();
      tiltEngine.beginInitial(ANIMATION_CONFIG.INITIAL_DURATION);
    } else {
      tiltEngine.setImmediate(shell.clientWidth / 2, shell.clientHeight / 2);
    }

    return () => {
      shell.removeEventListener("pointerenter", pointerEnterHandler);
      shell.removeEventListener("pointermove", pointerMoveHandler);
      shell.removeEventListener("pointerleave", pointerLeaveHandler);
      if (enterTimerRef.current) window.clearTimeout(enterTimerRef.current);
      if (leaveRafRef.current) cancelAnimationFrame(leaveRafRef.current);
      tiltEngine.cancel();
      shell.classList.remove("entering");
    };
  }, [enableTilt, tiltEngine, handlePointerMove, handlePointerEnter, handlePointerLeave]);

  // Gyroscope tilt on phones: one shared sensor listener, and each card only
  // subscribes while it is on screen.
  useEffect(() => {
    if (!enableTilt || !enableMobileTilt || !tiltEngine) return;
    const wrap = wrapRef.current;
    const shell = shellRef.current;
    if (!wrap || !shell) return;

    let unsubscribe: (() => void) | null = null;
    const onTilt = (nx: number, ny: number) => {
      const w = shell.clientWidth;
      const h = shell.clientHeight;
      const moving = nx !== 0 || ny !== 0;
      wrap.classList.toggle("gyro", moving);
      // full phone tilt maps to the card edge, i.e. the maximum rotation
      tiltEngine.setTarget(w / 2 + nx * w * 0.5, h / 2 + ny * h * 0.5);
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        if (entry.isIntersecting && !unsubscribe) {
          unsubscribe = subscribeTilt(onTilt);
        } else if (!entry.isIntersecting && unsubscribe) {
          unsubscribe();
          unsubscribe = null;
          wrap.classList.remove("gyro");
          tiltEngine.toCenter();
        }
      },
      { rootMargin: "100px" },
    );
    io.observe(wrap);

    return () => {
      io.disconnect();
      if (unsubscribe) unsubscribe();
    };
  }, [enableTilt, enableMobileTilt, tiltEngine]);

  const copyText = (e: MouseEvent, text: string, kind: "phone" | "email") => {
    e.preventDefault();
    e.stopPropagation();
    if (!text) return;
    const done = () => {
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    };
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard
        .writeText(text)
        .then(done)
        .catch(() => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  };

  const fallbackCopy = (text: string, done: () => void) => {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.left = "-999999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      done();
    } catch (err) {
      console.warn("Fallback copy failed:", err);
    }
  };

  const roleLabel = member.tag ?? (member.badgeText || member.role || "Crew");

  const photo = member.image ?? teamPhotoFor(member.id);
  const hasPhoto = Boolean(photo) && !imageError;

  const cardStyle = useMemo(
    () => cssVars({ "--behind-glow-color": behindGlowColor, "--behind-glow-size": behindGlowSize }),
    [behindGlowColor, behindGlowSize],
  );

  return (
    <div ref={wrapRef} className={`team-pass-card-wrapper ${className}`.trim()} style={cardStyle}>
      {/* Behind Glow following cursor */}
      {behindGlowEnabled && <div className="pc-behind" aria-hidden="true" />}

      {/* Tilt Interactive Shell */}
      <div ref={shellRef} className="team-pass-shell">
        <article className="tc-card" id={`pass-${member.id}`}>
          <div className="pc-glare" aria-hidden="true" />
          <div className="tc-art" aria-hidden="true">
            <svg
              className="tc-art-wave"
              viewBox="0 0 288 90"
              preserveAspectRatio="none"
              fill="none"
            >
              <path
                d="M0 14 C26 20 38 52 70 56 C110 62 170 40 288 8 L288 90 L0 90 Z"
                fill="#fbe3e3"
              />
              <path d="M52 62 C110 86 170 60 250 48" stroke="#e08a92" strokeWidth="1" />
            </svg>
            <svg className="tc-art-flower" viewBox="0 0 40 40" aria-hidden="true">
              <g transform="translate(20 20)" fill="#f9c5cb" stroke="#d9707c" strokeWidth="1">
                <path d="M0-3 C-8-8 -7-18 0-17 C7-18 8-8 0-3Z" />
                <path d="M0-3 C-8-8 -7-18 0-17 C7-18 8-8 0-3Z" transform="rotate(72)" />
                <path d="M0-3 C-8-8 -7-18 0-17 C7-18 8-8 0-3Z" transform="rotate(144)" />
                <path d="M0-3 C-8-8 -7-18 0-17 C7-18 8-8 0-3Z" transform="rotate(216)" />
                <path d="M0-3 C-8-8 -7-18 0-17 C7-18 8-8 0-3Z" transform="rotate(288)" />
              </g>
              <circle cx="20" cy="20" r="2" fill="#b4505c" />
            </svg>
          </div>

          <div className="tc-crew">{festTag}</div>

          <div className="tc-avatar-ring">
            <div className="tc-avatar">
              {hasPhoto ? (
                <img
                  src={photo}
                  alt={member.name}
                  className="tc-avatar-img"
                  loading="lazy"
                  onError={() => setImageError(true)}
                />
              ) : (
                <svg
                  viewBox="0 0 64 64"
                  className="tc-silhouette"
                  role="img"
                  aria-label={member.name}
                >
                  <circle cx="32" cy="24" r="11" fill="#c2c2c6" />
                  <path
                    d="M11 52 C11 42 20 39 32 39 C44 39 53 42 53 52 C53 55 49 55 32 55 C15 55 11 55 11 52Z"
                    fill="#c2c2c6"
                  />
                </svg>
              )}
            </div>
          </div>

          <h3 className="tc-name" title={member.name}>
            {member.name}
          </h3>
          {!hideRoleInside && <div className="tc-role">{roleLabel}</div>}

          {((SHOW_PHONE && member.phone) || member.email) && (
            <div className="tc-contacts">
              {SHOW_PHONE && member.phone && (
                <button
                  type="button"
                  className={`tc-icon-btn ${copied === "phone" ? "copied" : ""}`}
                  onClick={(e) => copyText(e, member.phone, "phone")}
                  title={copied === "phone" ? "Copied!" : `${member.phone} (click to copy)`}
                  aria-label={`Copy phone number ${member.phone}`}
                >
                  {copied === "phone" ? (
                    CHECK
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                  )}
                </button>
              )}
              {member.email && (
                <button
                  type="button"
                  className={`tc-icon-btn ${copied === "email" ? "copied" : ""}`}
                  onClick={(e) => copyText(e, member.email, "email")}
                  aria-label={`Copy email ${member.email}`}
                >
                  {copied === "email" ? (
                    CHECK
                  ) : (
                    <svg
                      viewBox="0 0 24 24"
                      width="18"
                      height="18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <rect x="2" y="4" width="20" height="16" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  )}
                </button>
              )}
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
