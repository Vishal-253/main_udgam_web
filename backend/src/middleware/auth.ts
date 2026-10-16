import type { NextFunction, Request, Response } from "express";
import { optionalEnv } from "../config/env";
import { verifyAdminToken } from "../services/adminAuth";

const bearer = (req: Request) => {
  const h = req.get("authorization") ?? "";
  return /^Bearer\s+/i.test(h) ? h.replace(/^Bearer\s+/i, "").trim() : undefined;
};

/** Rejects the request with 401 unless it carries a valid admin token. */
export async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const user = await verifyAdminToken(bearer(req));
  if (!user) {
    res.status(401).json({ ok: false, error: "unauthorized", message: "Please log in again." });
    return;
  }
  res.locals["admin"] = user;
  next();
}

function tokenMatches(given: string, expected: string): boolean {
  if (given.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Admin token OR the scheduler's BACKUP_SYNC_TOKEN (24+ chars) — for the backup-sync endpoint. */
export async function requireAdminOrSyncToken(req: Request, res: Response, next: NextFunction) {
  const given = bearer(req) ?? "";
  const syncToken = optionalEnv("BACKUP_SYNC_TOKEN");
  if (syncToken && syncToken.length >= 24 && tokenMatches(given, syncToken)) {
    next();
    return;
  }
  await requireAdmin(req, res, next);
}
