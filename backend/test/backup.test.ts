import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------- DB mock (records queries)
const dbCalls: { q: string; values: unknown[] }[] = [];
let dbResponder: (q: string, values: unknown[]) => unknown[] = () => [];
vi.mock("../src/db/client", () => ({
  db:
    () =>
    (strings: TemplateStringsArray, ...values: unknown[]) => {
      const q = strings.join("?");
      dbCalls.push({ q, values });
      return Promise.resolve(dbResponder(q, values));
    },
}));

import { backupRegistration, syncPending } from "../src/services/backup";
import { toFirestoreValue, upsertVersioned } from "../src/services/firestore";

// ---------------------------------------------------------------- fake Google + Firestore
let publicKey: CryptoKey;
let pem = "";
type Doc = { version: number; updateTime: string; fields: Record<string, unknown> };
const store = new Map<string, Doc>();
let failNextCommitWith: string | null = null;
let firestoreDown = false;
const commits: unknown[] = [];

const b64urlDecode = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function fakeFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = String(input);
  if (url === "https://oauth2.googleapis.com/token") {
    // verify the service-account JWT is really signed with the configured key
    const assertion = new URLSearchParams(String(init?.body)).get("assertion") ?? "";
    const [h, c, sig] = assertion.split(".");
    const ok = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      b64urlDecode(sig ?? ""),
      new TextEncoder().encode(`${h}.${c}`),
    );
    if (!ok) return new Response("bad jwt", { status: 401 });
    return Response.json({ access_token: "tok", expires_in: 3600 });
  }
  if (firestoreDown) return new Response("unavailable", { status: 503 });
  if (url.includes(":commit")) {
    const body = JSON.parse(String(init?.body)) as {
      writes: {
        update: {
          name: string;
          fields: { version: { integerValue: string } } & Record<string, unknown>;
        };
        currentDocument: { exists?: false; updateTime?: string };
      }[];
    };
    commits.push(body);
    const w = body.writes[0]!;
    if (failNextCommitWith) {
      const status = failNextCommitWith;
      failNextCommitWith = null;
      return new Response(JSON.stringify({ error: { status } }), { status: 400 });
    }
    const existing = store.get(w.update.name);
    if (w.currentDocument.exists === false && existing) {
      return new Response('{"error":{"status":"ALREADY_EXISTS"}}', { status: 409 });
    }
    if (w.currentDocument.updateTime && existing?.updateTime !== w.currentDocument.updateTime) {
      return new Response('{"error":{"status":"FAILED_PRECONDITION"}}', { status: 400 });
    }
    store.set(w.update.name, {
      version: Number(w.update.fields.version.integerValue),
      updateTime: `t${commits.length}`,
      fields: w.update.fields,
    });
    return Response.json({});
  }
  // GET document
  const name = url.replace("https://firestore.googleapis.com/v1/", "").split("?")[0]!;
  const doc = store.get(name);
  if (!doc) return new Response("{}", { status: 404 });
  return Response.json({
    name,
    updateTime: doc.updateTime,
    fields: { version: { integerValue: String(doc.version) } },
  });
}

beforeAll(async () => {
  const pair = (await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"],
  )) as CryptoKeyPair;
  publicKey = pair.publicKey;
  const der = new Uint8Array(await crypto.subtle.exportKey("pkcs8", pair.privateKey));
  let bin = "";
  for (const b of der) bin += String.fromCharCode(b);
  // stored the way secret managers usually hold it: one line with literal \n
  pem = `-----BEGIN PRIVATE KEY-----\\n${btoa(bin)}\\n-----END PRIVATE KEY-----\\n`;
});

const sa = () => ({
  projectId: "udgam-test",
  clientEmail: "svc@udgam-test.iam.gserviceaccount.com",
  privateKey: pem.replace(/\\n/g, "\n"),
});
const docName = (id: string) =>
  `projects/udgam-test/databases/(default)/documents/registrations/${id}`;

beforeEach(() => {
  store.clear();
  commits.length = 0;
  dbCalls.length = 0;
  failNextCommitWith = null;
  firestoreDown = false;
  vi.stubGlobal("fetch", vi.fn(fakeFetch));
  process.env["FIREBASE_PROJECT_ID"] = "udgam-test";
  process.env["FIREBASE_CLIENT_EMAIL"] = "svc@udgam-test.iam.gserviceaccount.com";
  process.env["FIREBASE_PRIVATE_KEY"] = pem;
});

describe("firestore value encoding", () => {
  it("encodes every JSON shape Firestore needs", () => {
    expect(toFirestoreValue(null)).toEqual({ nullValue: null });
    expect(toFirestoreValue(5)).toEqual({ integerValue: "5" });
    expect(toFirestoreValue(1.5)).toEqual({ doubleValue: 1.5 });
    expect(toFirestoreValue("a")).toEqual({ stringValue: "a" });
    expect(toFirestoreValue(true)).toEqual({ booleanValue: true });
    expect(toFirestoreValue(new Date("2026-01-02T03:04:05Z"))).toEqual({
      timestampValue: "2026-01-02T03:04:05.000Z",
    });
    expect(toFirestoreValue([{ roll_no: "B23X01", is_leader: true }])).toEqual({
      arrayValue: {
        values: [
          {
            mapValue: {
              fields: { roll_no: { stringValue: "B23X01" }, is_leader: { booleanValue: true } },
            },
          },
        ],
      },
    });
  });
});

describe("versioned upsert", () => {
  it("creates, updates, and never overwrites a newer version with an older one", async () => {
    expect(await upsertVersioned(sa(), "registrations", "r1", 1, { status: "pending" })).toBe(
      "written",
    );
    expect(await upsertVersioned(sa(), "registrations", "r1", 3, { status: "confirmed" })).toBe(
      "written",
    );
    // a slow, stale writer arrives late
    expect(await upsertVersioned(sa(), "registrations", "r1", 2, { status: "pending" })).toBe(
      "already_newer",
    );
    const doc = store.get(docName("r1"))!;
    expect(doc.version).toBe(3);
    expect(doc.fields["status"]).toEqual({ stringValue: "confirmed" });
  });

  it("retries when another writer got in between read and write", async () => {
    failNextCommitWith = "FAILED_PRECONDITION";
    expect(await upsertVersioned(sa(), "registrations", "r2", 1, { status: "pending" })).toBe(
      "written",
    );
    expect(commits).toHaveLength(2);
  });

  it("throws on real errors so the caller can record the failure", async () => {
    firestoreDown = true;
    await expect(upsertVersioned(sa(), "registrations", "r3", 1, {})).rejects.toThrow(/503/);
  });
});

describe("backupRegistration", () => {
  const row = (version: number, status: string) => ({
    id: "11111111-1111-4111-8111-111111111111",
    version: String(version), // Postgres bigint arrives as a string
    event_id: "rangoli",
    team_name: "Blossoms",
    status,
    amount_paise: 8000,
    members: [{ name: "Asha Rai", roll_no: "B23CS001", is_leader: true }],
    leader_roll_no: "B23CS001",
    leader_email: "asha@example.com",
    leader_phone: "9876543210",
    razorpay_order_id: "order_X",
    razorpay_payment_id: null,
    expires_at: new Date(),
    confirmed_at: null,
    created_at: new Date(),
    updated_at: new Date(),
  });

  it("copies the current row and records the synced version", async () => {
    dbResponder = (q) => (q.includes("FROM registrations WHERE id") ? [row(2, "confirmed")] : []);
    expect(await backupRegistration("11111111-1111-4111-8111-111111111111")).toBe(true);
    const doc = store.get(docName("11111111-1111-4111-8111-111111111111"))!;
    expect(doc.version).toBe(2);
    expect(doc.fields["eventName"]).toEqual({ stringValue: "Rangoli" });
    const mark = dbCalls.find((c) => c.q.includes("udgam_mark_synced"));
    expect(mark?.values).toEqual(["11111111-1111-4111-8111-111111111111", 2]);
  });

  it("never throws when Firebase is down; records the failure for retry", async () => {
    firestoreDown = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbResponder = (q) => (q.includes("FROM registrations WHERE id") ? [row(1, "pending")] : []);
    expect(await backupRegistration("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(dbCalls.some((c) => c.q.includes("udgam_mark_sync_failed"))).toBe(true);
    expect(dbCalls.some((c) => c.q.includes("udgam_mark_synced"))).toBe(false);
  });

  it("does nothing (and reports not configured) without Firebase credentials", async () => {
    delete process.env["FIREBASE_PRIVATE_KEY"];
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    dbResponder = (q) => (q.includes("count(*)") ? [{ n: 4 }] : []);
    expect(await backupRegistration("11111111-1111-4111-8111-111111111111")).toBe(false);
    expect(await syncPending(10)).toEqual({
      configured: false,
      synced: 0,
      failed: 0,
      remaining: 4,
    });
  });

  it("syncPending backs up every listed registration", async () => {
    const ids = ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"];
    dbResponder = (q, values) => {
      if (q.includes("FROM udgam_unsynced")) return ids.map((id) => ({ id }));
      if (q.includes("FROM registrations WHERE id"))
        return [{ ...row(1, "confirmed"), id: values[0] }];
      if (q.includes("count(*)")) return [{ n: 0 }];
      return [];
    };
    expect(await syncPending(10)).toEqual({ configured: true, synced: 2, failed: 0, remaining: 0 });
    expect(store.size).toBe(2);
  });
});
