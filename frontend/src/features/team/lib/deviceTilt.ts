/**
 * Shared gyroscope tilt controller for touch devices.
 *
 * One `deviceorientation` listener feeds every subscribed card, so cost does not grow
 * with the number of cards. Readings are mapped to the current screen orientation and
 * measured against a baseline that starts at the user's natural holding angle and slowly
 * follows posture changes, so "flat" is always however the phone is being held.
 *
 * States:
 *   'checking'     probing whether permission can be granted without a tap
 *   'unsupported'  no gyroscope / not a touch device / insecure context
 *   'reduced'      user prefers reduced motion
 *   'prompt'       iOS: needs a user gesture to request permission (shows the pill)
 *   'regrant'      iOS, granted on an earlier visit: re-requested silently on first tap
 *   'granted'      tilt is live
 *   'denied'       permission refused, or turned off by the user
 */

export type TiltState =
  "checking" | "unsupported" | "reduced" | "prompt" | "regrant" | "granted" | "denied";
type TiltListener = (nx: number, ny: number) => void;
type StateListener = (state: TiltState) => void;

// iOS Safari gates the sensor behind DeviceOrientationEvent.requestPermission()
type PermissionedOrientationEvent = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<"granted" | "denied">;
};
const orientationEvent = () =>
  hasWindow
    ? (window.DeviceOrientationEvent as PermissionedOrientationEvent | undefined)
    : undefined;

const STORAGE_KEY = "udgam_tilt_permission";
const MAX_TILT_DEG = 12; // degrees of phone tilt that map to a full card tilt
const BASELINE_TAU_MS = 9000; // how slowly "flat" follows a new holding posture
const NO_DATA_TIMEOUT_MS = 1500; // only empty readings by then means no gyroscope

const hasWindow = typeof window !== "undefined";

const readStore = () => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};
const writeStore = (v: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, v);
  } catch {
    /* storage unavailable */
  }
};

const isTouchDevice = () =>
  hasWindow && window.matchMedia("(hover: none) and (pointer: coarse)").matches;

const prefersReducedMotion = () =>
  hasWindow && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const needsPermission = () => typeof orientationEvent()?.requestPermission === "function";

const baseSupport = () =>
  hasWindow && "DeviceOrientationEvent" in window && window.isSecureContext && isTouchDevice();

const tiltSubs = new Set<TiltListener>();
const stateSubs = new Set<StateListener>();

let state: TiltState = "unsupported";
let listening = false;
let rafId = 0;
let raw: { beta: number; gamma: number } | null = null; // latest reading
let baseline: { x: number; y: number } | null = null; // in screen space
let lastTs = 0;
let noDataTimer: ReturnType<typeof setTimeout> | 0 = 0;
let sawEmptyReading = false;
let gestureArmed = false;

const setState = (next: TiltState) => {
  if (next === state) return;
  state = next;
  stateSubs.forEach((fn) => fn(state));
  syncListener();
};

const screenAngle = () => {
  const a = hasWindow && window.screen?.orientation?.angle;
  if (typeof a === "number") return a;
  return typeof window.orientation === "number" ? window.orientation : 0;
};

// Device beta/gamma -> left/right (x) and forward/back (y) relative to the screen.
const toScreen = (beta: number, gamma: number) => {
  switch ((screenAngle() + 360) % 360) {
    case 90:
      return { x: beta, y: -gamma };
    case 180:
      return { x: -gamma, y: -beta };
    case 270:
      return { x: -beta, y: gamma };
    default:
      return { x: gamma, y: beta };
  }
};

const wrapDeg = (d: number) => ((d + 540) % 360) - 180;
const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

const frame = (ts: number) => {
  rafId = 0;
  if (!raw) return;
  const s = toScreen(raw.beta, raw.gamma);
  const dt = lastTs ? ts - lastTs : 16;
  lastTs = ts;

  if (!baseline) baseline = { ...s };
  // Baseline eases toward the current posture so holding the phone differently re-centres.
  const k = 1 - Math.exp(-dt / BASELINE_TAU_MS);
  baseline.x += wrapDeg(s.x - baseline.x) * k;
  baseline.y += wrapDeg(s.y - baseline.y) * k;

  const nx = clamp1(wrapDeg(s.x - baseline.x) / MAX_TILT_DEG);
  const ny = clamp1(wrapDeg(s.y - baseline.y) / MAX_TILT_DEG);
  tiltSubs.forEach((fn) => fn(nx, ny));
};

const onOrientation = (e: DeviceOrientationEvent) => {
  if (e.beta == null || e.gamma == null) {
    sawEmptyReading = true; // desktops / sensorless devices send nulls
    return;
  }
  if (noDataTimer) {
    clearTimeout(noDataTimer);
    noDataTimer = 0;
  }
  raw = { beta: e.beta, gamma: e.gamma };
  // Real readings prove access is allowed, whatever the permission probe said.
  if (state !== "granted") setState("granted");
  if (!rafId) rafId = requestAnimationFrame(frame);
};

const recalibrate = () => {
  baseline = null;
  lastTs = 0;
};

const onVisibility = () => {
  recalibrate();
  syncListener();
};

const startListening = () => {
  if (listening) return;
  listening = true;
  recalibrate();
  window.addEventListener("deviceorientation", onOrientation);
  // Only empty readings soon after starting means there is no gyroscope to use.
  // (No events at all is left alone: the listener is idle and costs nothing.)
  sawEmptyReading = false;
  noDataTimer = setTimeout(() => {
    noDataTimer = 0;
    if (!raw && sawEmptyReading) setState("unsupported");
  }, NO_DATA_TIMEOUT_MS);
};

const stopListening = () => {
  if (!listening) return;
  listening = false;
  window.removeEventListener("deviceorientation", onOrientation);
  if (rafId) cancelAnimationFrame(rafId);
  if (noDataTimer) clearTimeout(noDataTimer);
  rafId = 0;
  noDataTimer = 0;
  raw = null;
  tiltSubs.forEach((fn) => fn(0, 0));
};

function syncListener() {
  if (!hasWindow) return;
  // Listen while permission is still undecided too: if readings arrive, access is
  // allowed (Android) and we switch to 'granted' without ever asking.
  const live =
    state === "granted" || state === "checking" || state === "prompt" || state === "regrant";
  const want = live && tiltSubs.size > 0 && !document.hidden;
  if (want) startListening();
  else stopListening();
}

const computeInitialState = (): TiltState => {
  if (!baseSupport()) return "unsupported";
  if (prefersReducedMotion()) return "reduced";
  const stored = readStore();
  if (stored === "denied") return "denied";
  if (!needsPermission()) return "granted";
  return stored === "granted" ? "regrant" : "prompt";
};

// iOS: a previous grant still needs requestPermission() from a gesture on each page load.
// Re-arm it silently on the first tap so returning users never see the prompt pill.
const armSilentRegrant = () => {
  if (gestureArmed || state !== "regrant") return;
  gestureArmed = true;
  const onGesture = () => {
    document.removeEventListener("touchend", onGesture, true);
    document.removeEventListener("click", onGesture, true);
    gestureArmed = false;
    requestTiltPermission();
  };
  document.addEventListener("touchend", onGesture, true);
  document.addEventListener("click", onGesture, true);
};

let initialised = false;
const init = () => {
  if (initialised || !hasWindow) return;
  initialised = true;
  state = computeInitialState();

  document.addEventListener("visibilitychange", onVisibility);
  window.addEventListener("orientationchange", recalibrate);
  window.screen?.orientation?.addEventListener?.("change", recalibrate);
  window
    .matchMedia("(prefers-reduced-motion: reduce)")
    .addEventListener?.("change", () => setState(computeInitialState()));

  if (state === "regrant") {
    armSilentRegrant();
  } else if (state === "prompt") {
    // Some browsers expose requestPermission() yet allow access without a gesture (or never
    // settle the call). Probe silently while listening; show the pill only if no readings
    // arrive and the probe is refused or still pending after a moment.
    state = "checking";
    let settled = false;
    const fallback = () => {
      if (settled) return;
      settled = true;
      if (state === "checking") setState("prompt");
    };
    orientationEvent()
      ?.requestPermission?.()
      .then((result) => {
        if (result === "granted") {
          settled = true;
          setState("granted");
        } else fallback();
      })
      .catch(fallback);
    setTimeout(fallback, 1000);
  }
};

/** Must be called from a user gesture (tap / click) on iOS. */
export function requestTiltPermission(): Promise<TiltState> {
  init();
  if (!needsPermission()) {
    writeStore("granted");
    setState(computeInitialState() === "unsupported" ? "unsupported" : "granted");
    return Promise.resolve(state);
  }
  const request = orientationEvent()?.requestPermission;
  if (!request) return Promise.resolve(state);
  return request()
    .then((result) => {
      writeStore(result === "granted" ? "granted" : "denied");
      setState(result === "granted" ? "granted" : "denied");
      return state;
    })
    .catch(() => {
      // Thrown when not triggered by a gesture: fall back to the visible prompt.
      if (state === "regrant") setState("prompt");
      return state;
    });
}

/** Turn tilt off (remembered) or back on. */
export function setTiltEnabled(enabled: boolean) {
  init();
  if (!enabled) {
    writeStore("denied");
    setState("denied");
    return;
  }
  writeStore("");
  const next = computeInitialState();
  setState(next);
  if (next === "prompt") requestTiltPermission();
}

export function getTiltState(): TiltState {
  init();
  return state;
}

export function subscribeTiltState(fn: StateListener) {
  init();
  stateSubs.add(fn);
  fn(state);
  return () => {
    stateSubs.delete(fn);
  };
}

/** fn(nx, ny): -1..1 left/right and back/forward relative to the user's holding angle. */
export function subscribeTilt(fn: TiltListener) {
  init();
  tiltSubs.add(fn);
  syncListener();
  return () => {
    tiltSubs.delete(fn);
    syncListener();
  };
}
