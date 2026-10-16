import { db } from "../db/client";
import { optionalEnv } from "../config/env";

// Admin panel authentication.
//
// Credentials live ONLY in environment variables (ADMIN_USERNAME / ADMIN_PASSWORD), never in code.
// A successful login returns a signed, expiring bearer token; the admin page sends it in the
// Authorization header (cookies are unreliable between the website and the API on different
// domains). Changing ADMIN_PASSWORD or ADMIN_SESSION_SECRET invalidates every issued token.
// Failed logins are throttled per IP and globally (udgam_admin_login_blocked in db/schema.sql).

const SESSION_HOURS = 8;

interface AdminConfig {
  username: string;
  password: string;
  secret: string;
}

function adminConfig(): AdminConfig | null {
  const username = optionalEnv("ADMIN_USERNAME");
  const password = optionalEnv("ADMIN_PASSWORD");
  const secret = optionalEnv("ADMIN_SESSION_SECRET");
  if (!username || !password || !secret || secret.length < 32) return null;
  return { username, password, secret };
}

const enc = new TextEncoder();

async function hmac(key: string, message: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(message)));
}

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

const b64url = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64url");
const fromB64url = (s: string) => new Uint8Array(Buffer.from(s, "base64url"));

/** Compares secrets via fixed-length HMACs so timing reveals nothing about length or content. */
async function secretEquals(given: string, expected: string, key: string): Promise<boolean> {
  return equalBytes(await hmac(key, given), await hmac(key, expected));
}

// the signing key includes the password so changing it invalidates all tokens
const signingKey = (cfg: AdminConfig) => `${cfg.secret}\u0000${cfg.password}`;

async function makeToken(cfg: AdminConfig): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Date.now() + SESSION_HOURS * 3600_000;
  const payload = b64url(enc.encode(JSON.stringify({ u: cfg.username, exp: expiresAt })));
  return { token: `${payload}.${b64url(await hmac(signingKey(cfg), payload))}`, expiresAt };
}

/** Username in a valid, unexpired token, or null. */
export async function verifyAdminToken(token: string | undefined): Promise<string | null> {
  const cfg = adminConfig();
  if (!cfg || !token || token.length > 512) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  try {
    if (!equalBytes(fromB64url(sig), await hmac(signingKey(cfg), payload))) return null;
    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload))) as {
      u?: string;
      exp?: number;
    };
    if (data.u !== cfg.username || typeof data.exp !== "number" || data.exp < Date.now()) {
      return null;
    }
    return data.u;
  } catch {
    return null;
  }
}

export type LoginResult =
  | { ok: true; username: string; token: string; expiresAt: number }
  | { ok: false; message: string };

export async function adminLogin(
  username: string,
  password: string,
  ip: string,
): Promise<LoginResult> {
  const cfg = adminConfig();
  if (!cfg) {
    console.error(
      "[admin] ADMIN_USERNAME / ADMIN_PASSWORD / ADMIN_SESSION_SECRET (32+ chars) not set",
    );
    return { ok: false, message: "Admin login is not configured on the server." };
  }
  const clientIp = ip.slice(0, 64) || "unknown";
  const blocked = (await db()`SELECT udgam_admin_login_blocked(${clientIp}) AS b`) as {
    b: boolean;
  }[];
  if (blocked[0]?.b) {
    return { ok: false, message: "Too many failed attempts. Try again in 15 minutes." };
  }

  const userOk = await secretEquals(username, cfg.username, cfg.secret);
  const passOk = await secretEquals(password, cfg.password, cfg.secret);
  const ok = userOk && passOk;
  await db()`INSERT INTO admin_login_attempts (ip, succeeded) VALUES (${clientIp}, ${ok})`;
  if (!ok) {
    console.warn("[admin] failed login", clientIp);
    return { ok: false, message: "Wrong username or password." };
  }
  const { token, expiresAt } = await makeToken(cfg);
  return { ok: true, username: cfg.username, token, expiresAt };
}
