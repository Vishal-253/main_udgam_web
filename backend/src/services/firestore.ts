import { optionalEnv } from "../config/env";

// Minimal Firestore REST client (fetch + Web Crypto, no SDK dependency).
// Auth: Google service account -> signed JWT (RS256 via Web Crypto) -> OAuth access token.
// Docs: https://firebase.google.com/docs/firestore/use-rest-api

const SCOPE = "https://www.googleapis.com/auth/datastore";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REQUEST_TIMEOUT_MS = 8000;

interface ServiceAccount {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function firestoreConfig(): ServiceAccount | null {
  const projectId = optionalEnv("FIREBASE_PROJECT_ID");
  const clientEmail = optionalEnv("FIREBASE_CLIENT_EMAIL");
  const rawKey = optionalEnv("FIREBASE_PRIVATE_KEY");
  if (!projectId || !clientEmail || !rawKey) return null;
  // secrets stores often keep the PEM on one line with literal "\n"
  return { projectId, clientEmail, privateKey: rawKey.replace(/\\n/g, "\n") };
}

// ---------------------------------------------------------------- auth

const b64url = (data: ArrayBuffer | Uint8Array | string) => {
  const bytes =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

let cachedToken: { value: string; expiresAt: number; email: string } | null = null;

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.email === sa.clientEmail && cachedToken.expiresAt - 60 > now) {
    return cachedToken.value;
  }
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    }),
  );
  const key = await importPrivateKey(sa.privateKey);
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const res = await fetchWithTimeout(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed (${res.status}): ${await res.text()}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    value: json.access_token,
    expiresAt: now + json.expires_in,
    email: sa.clientEmail,
  };
  return json.access_token;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ---------------------------------------------------------------- values

type FsValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { stringValue: string }
  | { timestampValue: string }
  | { arrayValue: { values: FsValue[] } }
  | { mapValue: { fields: Record<string, FsValue> } };

export function toFirestoreValue(v: unknown): FsValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "bigint") return { integerValue: v.toString() };
  if (typeof v === "number") {
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toFirestoreValue) } };
  if (typeof v === "object")
    return { mapValue: { fields: toFirestoreFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

export function toFirestoreFields(obj: Record<string, unknown>): Record<string, FsValue> {
  const out: Record<string, FsValue> = {};
  for (const [k, val] of Object.entries(obj)) {
    if (val !== undefined) out[k] = toFirestoreValue(val);
  }
  return out;
}

// ---------------------------------------------------------------- versioned upsert

export type UpsertResult = "written" | "already_newer";

/**
 * Writes `fields` to `collection/docId` only if the stored document's `version` field is older
 * than `version`. Uses an updateTime precondition (optimistic concurrency), so two concurrent
 * writers can never leave an older version on top of a newer one.
 */
export async function upsertVersioned(
  sa: ServiceAccount,
  collection: string,
  docId: string,
  version: number,
  fields: Record<string, unknown>,
): Promise<UpsertResult> {
  const token = await accessToken(sa);
  const dbPath = `projects/${encodeURIComponent(sa.projectId)}/databases/(default)/documents`;
  const name = `${dbPath}/${collection}/${encodeURIComponent(docId)}`;
  const api = "https://firestore.googleapis.com/v1";
  const auth = { authorization: `Bearer ${token}` };
  const body = toFirestoreFields({ ...fields, version });

  for (let attempt = 0; attempt < 4; attempt++) {
    const current = await fetchWithTimeout(`${api}/${name}?mask.fieldPaths=version`, {
      headers: auth,
    });
    let precondition: { exists: false } | { updateTime: string };
    if (current.status === 404) {
      precondition = { exists: false };
    } else if (current.ok) {
      const doc = (await current.json()) as {
        updateTime: string;
        fields?: { version?: { integerValue?: string } };
      };
      const stored = Number(doc.fields?.version?.integerValue ?? 0);
      if (stored >= version) return "already_newer";
      precondition = { updateTime: doc.updateTime };
    } else {
      throw new Error(`Firestore read failed (${current.status}): ${await current.text()}`);
    }

    const res = await fetchWithTimeout(`${api}/${dbPath}:commit`, {
      method: "POST",
      headers: { ...auth, "content-type": "application/json" },
      body: JSON.stringify({
        writes: [{ update: { name, fields: body }, currentDocument: precondition }],
      }),
    });
    if (res.ok) return "written";
    const text = await res.text();
    // someone else wrote between our read and write: re-read and decide again
    if (/FAILED_PRECONDITION|ALREADY_EXISTS|ABORTED/.test(text)) continue;
    throw new Error(`Firestore write failed (${res.status}): ${text}`);
  }
  throw new Error("Firestore write kept conflicting; will retry on the next sync");
}
