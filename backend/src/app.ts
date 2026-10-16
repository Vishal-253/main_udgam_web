import cors from "cors";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import { allowedOrigins } from "./config/env";
import { db } from "./db/client";
import { adminRouter } from "./routes/admin";
import { registrationsRouter } from "./routes/registrations";
import { webhookRouter } from "./routes/webhook";

/** Builds the Express app (no listening) so tests can run it directly. */
export function createApp() {
  const app = express();

  // Render (and most hosts) put one proxy in front; trust it so req.ip is the real client IP
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(helmet());

  // Liveness: cheap, no database — used by Render's health check and the keep-alive ping
  app.get("/health", (_req, res) => {
    res.json({ ok: true, uptimeSeconds: Math.round(process.uptime()) });
  });
  // Readiness: confirms the database is reachable
  app.get("/health/db", async (_req, res) => {
    try {
      await db()`SELECT 1`;
      res.json({ ok: true });
    } catch (err) {
      console.error("[health] database unreachable", err);
      res.status(503).json({ ok: false });
    }
  });

  // Razorpay calls this server-to-server; it needs the raw body, so it comes before express.json
  app.use("/api/razorpay/webhook", webhookRouter);

  // Browser APIs: only the website's origins may call them from a browser
  app.use(
    "/api",
    cors({
      origin: (origin, cb) => {
        // no Origin header = not a browser cross-site request (curl, server, same-origin)
        if (!origin) return cb(null, true);
        cb(null, allowedOrigins().includes(origin));
      },
      methods: ["GET", "POST"],
      allowedHeaders: ["Content-Type", "Authorization"],
      maxAge: 600,
    }),
  );
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "32kb" }));

  app.use("/api/registrations", registrationsRouter);
  app.use("/api/admin", adminRouter);

  app.use((_req, res) => {
    res.status(404).json({ ok: false, message: "Not found" });
  });

  // malformed JSON, oversized bodies, and anything unexpected: never leak internals
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number }).status;
    if (status && status >= 400 && status < 500) {
      res.status(status).json({ ok: false, code: "invalid", message: "Invalid request." });
      return;
    }
    console.error("[server] unhandled error", err);
    res.status(500).json({ ok: false, code: "error", message: "Something went wrong." });
  });

  return app;
}
