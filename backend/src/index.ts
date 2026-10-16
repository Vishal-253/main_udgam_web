import { createApp } from "./app";
import { optionalEnv, reportConfig } from "./config/env";

const PORT = Number(process.env["PORT"] ?? 4000);
const KEEP_ALIVE_MINUTES = 10;

reportConfig();

const server = createApp().listen(PORT, () => {
  console.log(`[server] Udgam API listening on :${PORT}`);
  startKeepAlive();
});

/**
 * Render's free plan sleeps a service after 15 minutes without incoming traffic. While the
 * server runs, it calls its own PUBLIC URL every 10 minutes, which counts as traffic and keeps
 * it awake. Render sets RENDER_EXTERNAL_URL automatically; KEEP_ALIVE_URL overrides it, and
 * KEEP_ALIVE_URL=off disables the ping. (An external cron hitting /api/admin/backup-sync every
 * 5 minutes is a second safety net — see README.)
 */
function startKeepAlive() {
  const configured = optionalEnv("KEEP_ALIVE_URL");
  if (configured === "off") return;
  const base = configured ?? optionalEnv("RENDER_EXTERNAL_URL");
  if (!base) {
    console.log("[keep-alive] no public URL (not on Render) — ping disabled");
    return;
  }
  const url = `${base.replace(/\/+$/, "")}/health`;
  const ping = async () => {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) console.warn(`[keep-alive] ${url} answered ${res.status}`);
    } catch (err) {
      console.warn("[keep-alive] ping failed", err instanceof Error ? err.message : err);
    }
  };
  setInterval(ping, KEEP_ALIVE_MINUTES * 60_000).unref();
  console.log(`[keep-alive] pinging ${url} every ${KEEP_ALIVE_MINUTES} minutes`);
}

// finish in-flight requests (e.g. a payment confirmation) before Render stops the old instance
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[server] ${signal} received, closing`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}

process.on("unhandledRejection", (err) => console.error("[server] unhandled rejection", err));
