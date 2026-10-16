// Server configuration from environment variables.
// Local dev: backend/.env (gitignored). Render: Dashboard -> Environment.

type EnvName =
  | "DATABASE_URL"
  | "RAZORPAY_KEY_ID"
  | "RAZORPAY_KEY_SECRET"
  | "RAZORPAY_WEBHOOK_SECRET"
  | "REGISTRATIONS_OPEN"
  | "FIREBASE_PROJECT_ID"
  | "FIREBASE_CLIENT_EMAIL"
  | "FIREBASE_PRIVATE_KEY"
  | "BACKUP_SYNC_TOKEN"
  | "ADMIN_USERNAME"
  | "ADMIN_PASSWORD"
  | "ADMIN_SESSION_SECRET"
  | "FRONTEND_ORIGINS"
  | "KEEP_ALIVE_URL"
  | "RENDER_EXTERNAL_URL";

function read(name: EnvName): string | undefined {
  return process.env[name]?.trim() || undefined;
}

export class ConfigError extends Error {}

/** Required secret: throws ConfigError (logged server-side; users see a generic error). */
export function requireEnv(name: EnvName): string {
  const value = read(name);
  if (!value) throw new ConfigError(`Missing environment variable ${name}`);
  return value;
}

export function optionalEnv(name: EnvName): string | undefined {
  return read(name);
}

/** Registrations stay closed unless REGISTRATIONS_OPEN is exactly "true". */
export function registrationsOpen(): boolean {
  return read("REGISTRATIONS_OPEN") === "true";
}

/** Browser origins allowed to call the API, e.g. "https://udgam.in,https://www.udgam.in". */
export function allowedOrigins(): string[] {
  return (read("FRONTEND_ORIGINS") ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

/** Logs which settings are missing at startup, so misconfiguration is visible immediately. */
export function reportConfig(): void {
  const required: EnvName[] = [
    "DATABASE_URL",
    "RAZORPAY_KEY_ID",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "FRONTEND_ORIGINS",
    "ADMIN_USERNAME",
    "ADMIN_PASSWORD",
    "ADMIN_SESSION_SECRET",
  ];
  const backup: EnvName[] = ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
  const missing = required.filter((n) => !read(n));
  const missingBackup = backup.filter((n) => !read(n));
  if (missing.length) console.error(`[config] MISSING required settings: ${missing.join(", ")}`);
  if (missingBackup.length) {
    console.error(`[config] Firebase backup DISABLED — missing: ${missingBackup.join(", ")}`);
  }
  if ((read("ADMIN_SESSION_SECRET") ?? "").length < 32) {
    console.error("[config] ADMIN_SESSION_SECRET must be at least 32 characters — admin login disabled");
  }
  console.log(`[config] registrations ${registrationsOpen() ? "OPEN" : "closed"}`);
}
