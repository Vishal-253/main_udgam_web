import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const syncPending = vi.fn();
let firebaseConfigured = true;
vi.mock("../src/services/backup", () => ({ syncPending: (n: number) => syncPending(n) }));
vi.mock("../src/services/firestore", () => ({
  firestoreConfig: () => (firebaseConfigured ? { projectId: "p" } : null),
}));

const { startBackupScheduler } = await import("../src/jobs/backupScheduler");

const done = { configured: true, synced: 0, failed: 0, remaining: 0 };

beforeEach(() => {
  vi.useFakeTimers();
  syncPending.mockReset();
  syncPending.mockResolvedValue(done);
  firebaseConfigured = true;
  process.env["DATABASE_URL"] = "postgresql://x";
  delete process.env["BACKUP_INTERVAL_MINUTES"];
  vi.spyOn(console, "log").mockImplementation(() => undefined);
  vi.spyOn(console, "error").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("automatic Firebase backup", () => {
  it("runs 30s after start and then every 5 minutes by default", async () => {
    const s = startBackupScheduler();
    expect(s).not.toBeNull();
    await vi.advanceTimersByTimeAsync(29_000);
    expect(syncPending).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1_000);
    expect(syncPending).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(syncPending).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(syncPending).toHaveBeenCalledTimes(4);
    s?.stop();
  });

  it("keeps going until the backlog is cleared", async () => {
    syncPending
      .mockResolvedValueOnce({ configured: true, synced: 50, failed: 0, remaining: 70 })
      .mockResolvedValueOnce({ configured: true, synced: 50, failed: 0, remaining: 20 })
      .mockResolvedValueOnce({ configured: true, synced: 20, failed: 0, remaining: 0 });
    const s = startBackupScheduler();
    await s?.runOnce();
    expect(syncPending).toHaveBeenCalledTimes(3);
    s?.stop();
  });

  it("stops a run when a pass makes no progress (e.g. Firebase down)", async () => {
    syncPending.mockResolvedValue({ configured: true, synced: 0, failed: 50, remaining: 80 });
    const s = startBackupScheduler();
    await s?.runOnce();
    expect(syncPending).toHaveBeenCalledTimes(1);
    s?.stop();
  });

  it("never runs two backups at the same time", async () => {
    let release: () => void = () => {};
    syncPending.mockImplementationOnce(
      () => new Promise((r) => (release = () => r(done))),
    );
    const s = startBackupScheduler();
    const first = s?.runOnce();
    await s?.runOnce(); // skipped: first still running
    expect(syncPending).toHaveBeenCalledTimes(1);
    release();
    await first;
    await s?.runOnce();
    expect(syncPending).toHaveBeenCalledTimes(2);
    s?.stop();
  });

  it("survives a failing run and tries again next time", async () => {
    syncPending.mockRejectedValueOnce(new Error("db down"));
    const s = startBackupScheduler();
    await s?.runOnce();
    await s?.runOnce();
    expect(syncPending).toHaveBeenCalledTimes(2);
    s?.stop();
  });

  it("does nothing when Firebase or the database isn't configured", async () => {
    firebaseConfigured = false;
    const s = startBackupScheduler();
    await s?.runOnce();
    expect(syncPending).not.toHaveBeenCalled();
    s?.stop();
  });

  it("respects BACKUP_INTERVAL_MINUTES and can be disabled with 0", async () => {
    process.env["BACKUP_INTERVAL_MINUTES"] = "0";
    expect(startBackupScheduler()).toBeNull();
    process.env["BACKUP_INTERVAL_MINUTES"] = "2";
    const s = startBackupScheduler();
    await vi.advanceTimersByTimeAsync(30_000 + 2 * 60_000);
    expect(syncPending).toHaveBeenCalledTimes(2);
    s?.stop();
  });
});
