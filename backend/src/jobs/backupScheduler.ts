import { optionalEnv } from "../config/env";
import { firestoreConfig } from "../services/firestore";
import { syncPending } from "../services/backup";

// Automatic Firebase backup: every BACKUP_INTERVAL_MINUTES (default 5) the server copies every
// registration whose latest version isn't in Firestore yet. Each registration is also backed up
// the moment it changes; this job catches anything that slipped through (Firebase briefly down,
// holds expiring inside the database, a restart mid-request).
//
// Safe by design: runs never overlap, a failing run is logged and retried next time, and
// Firestore writes are version-checked, so even two servers running this at once can't
// overwrite newer data with older data.

const BATCH = 50; // registrations per pass
const MAX_PASSES = 20; // up to 1000 per run, then continue next interval

export interface BackupScheduler {
  stop: () => void;
  /** runs one backup now (used at startup and by tests) */
  runOnce: () => Promise<void>;
}

export function startBackupScheduler(): BackupScheduler | null {
  const raw = optionalEnv("BACKUP_INTERVAL_MINUTES");
  const minutes = raw === undefined ? 5 : Number(raw);
  if (!Number.isFinite(minutes) || minutes <= 0) {
    console.log("[backup] automatic backup disabled (BACKUP_INTERVAL_MINUTES)");
    return null;
  }

  let running = false;

  const runOnce = async () => {
    if (running) return; // previous run still going: skip, never overlap
    if (!firestoreConfig() || !optionalEnv("DATABASE_URL")) return; // not configured
    running = true;
    const started = Date.now();
    let synced = 0;
    let failed = 0;
    let remaining = 0;
    try {
      for (let pass = 0; pass < MAX_PASSES; pass++) {
        const r = await syncPending(BATCH);
        synced += r.synced;
        failed += r.failed;
        remaining = r.remaining;
        // stop when everything is backed up, or when this pass made no progress
        if (r.remaining === 0 || r.synced === 0) break;
      }
      if (synced || failed) {
        console.log(
          `[backup] auto: ${synced} backed up, ${failed} failed, ${remaining} left (${Date.now() - started} ms)`,
        );
      }
    } catch (err) {
      console.error("[backup] auto backup run failed; will retry next interval", err);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void runOnce(), minutes * 60_000);
  timer.unref();
  // first run shortly after startup, so a restart catches up quickly
  const first = setTimeout(() => void runOnce(), 30_000);
  first.unref();
  console.log(`[backup] automatic Firebase backup every ${minutes} minute(s)`);

  return {
    stop: () => {
      clearInterval(timer);
      clearTimeout(first);
    },
    runOnce,
  };
}
