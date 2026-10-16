import { Router, type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { EVENTS } from "../data/events";
import { requireAdmin, requireAdminOrSyncToken } from "../middleware/auth";
import { adminLogin } from "../services/adminAuth";
import { getEventRegistrations, getOverview, searchRegistrations } from "../services/adminData";
import { syncPending } from "../services/backup";
import type { RegistrationStatus } from "../types";

// Admin API (read-only over registrations).
//   POST /api/admin/login                         -> { ok, token, username, expiresAt }
//   GET  /api/admin/session                       -> { username }
//   GET  /api/admin/overview
//   GET  /api/admin/events/:eventId/registrations?status=confirmed|pending|...|all
//   GET  /api/admin/search?q=
//   POST /api/admin/backup-sync                   (admin token or BACKUP_SYNC_TOKEN)

export const adminRouter = Router();

// a second line of defence on top of the per-IP lockout stored in the database
const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, message: "Too many login attempts. Try again later." },
});

const failure = (res: Response, label: string, err: unknown) => {
  console.error(`[admin] ${label} failed`, err);
  res.status(500).json({ ok: false, error: "error", message: "Something went wrong loading this data." });
};

adminRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = z
    .object({ username: z.string().max(100), password: z.string().max(200) })
    .safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, message: "Enter a username and password." });
    return;
  }
  try {
    const result = await adminLogin(parsed.data.username, parsed.data.password, req.ip ?? "");
    res.status(result.ok ? 200 : 401).json(result);
  } catch (err) {
    console.error("[admin] login failed", err);
    res.status(500).json({ ok: false, message: "Login is unavailable right now." });
  }
});

adminRouter.get("/session", requireAdmin, (_req, res) => {
  res.json({ username: res.locals["admin"] as string });
});

adminRouter.get("/overview", requireAdmin, async (_req, res) => {
  try {
    res.json({ ok: true, data: await getOverview() });
  } catch (err) {
    failure(res, "overview", err);
  }
});

const statuses = ["all", "pending", "confirmed", "expired", "cancelled", "refund_required"] as const;
const eventIds = new Set(EVENTS.map((e) => e.id));

adminRouter.get("/events/:eventId/registrations", requireAdmin, async (req, res) => {
  const eventId = String(req.params["eventId"] ?? "");
  const status = z.enum(statuses).safeParse(req.query["status"] ?? "confirmed");
  if (!eventIds.has(eventId) || !status.success) {
    res.status(400).json({ ok: false, error: "error", message: "Unknown event or status." });
    return;
  }
  try {
    const data = await getEventRegistrations(eventId, status.data as RegistrationStatus | "all");
    res.json({ ok: true, data });
  } catch (err) {
    failure(res, "event registrations", err);
  }
});

adminRouter.get("/search", requireAdmin, async (req, res) => {
  const q = z.string().trim().min(2).max(100).safeParse(req.query["q"]);
  if (!q.success) {
    res.status(400).json({ ok: false, error: "error", message: "Type at least 2 characters." });
    return;
  }
  try {
    res.json({ ok: true, data: await searchRegistrations(q.data) });
  } catch (err) {
    failure(res, "search", err);
  }
});

adminRouter.post("/backup-sync", requireAdminOrSyncToken, async (_req, res) => {
  try {
    const data = await syncPending(50);
    res.status(data.configured ? 200 : 503).json({ ok: true, data });
  } catch (err) {
    failure(res, "backup sync", err);
  }
});
