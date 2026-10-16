import { requireEnv } from "../config/env";

// Minimal Razorpay client using fetch + Web Crypto (no SDK dependency).
// Docs: https://razorpay.com/docs/api/orders/

const API = "https://api.razorpay.com/v1";

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

export async function createOrder(input: {
  amountPaise: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<RazorpayOrder> {
  const res = await fetch(`${API}/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: authHeader() },
    body: JSON.stringify({
      amount: input.amountPaise,
      currency: "INR",
      receipt: input.receipt.slice(0, 40),
      notes: input.notes,
    }),
  });
  if (!res.ok) {
    // body may contain Razorpay's error description; log it, never return it to the client
    throw new Error(`Razorpay order creation failed (${res.status}): ${await res.text()}`);
  }
  const order = (await res.json()) as RazorpayOrder;
  if (!order.id || order.amount !== input.amountPaise) {
    throw new Error("Razorpay returned an unexpected order");
  }
  return order;
}

function authHeader(): string {
  return `Basic ${btoa(`${requireEnv("RAZORPAY_KEY_ID")}:${requireEnv("RAZORPAY_KEY_SECRET")}`)}`;
}

export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
}

export async function fetchPayment(paymentId: string): Promise<RazorpayPayment> {
  const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}`, {
    headers: { authorization: authHeader() },
  });
  if (!res.ok)
    throw new Error(`Razorpay payment fetch failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as RazorpayPayment;
}

/**
 * Confirms with Razorpay itself that `paymentId` paid `orderId` in full, capturing it if it is
 * only authorized (uncaptured payments are auto-refunded by Razorpay after a few days).
 * Returns the captured amount in paise, or null if the payment is not a valid, paid payment.
 */
export async function ensureCaptured(
  paymentId: string,
  orderId: string,
  expectedPaise: number,
): Promise<number | null> {
  let payment = await fetchPayment(paymentId);
  if (payment.order_id !== orderId || payment.currency !== "INR") return null;
  if (payment.status === "authorized") {
    const res = await fetch(`${API}/payments/${encodeURIComponent(paymentId)}/capture`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: authHeader() },
      body: JSON.stringify({ amount: payment.amount, currency: "INR" }),
    });
    if (res.ok) {
      payment = (await res.json()) as RazorpayPayment;
    } else {
      // a concurrent capture (webhook vs browser) makes this call fail — re-read the real state
      payment = await fetchPayment(paymentId);
    }
  }
  if (payment.status !== "captured") return null;
  // amount mismatch is still returned so the caller can flag the registration for refund
  return payment.amount === expectedPaise ? expectedPaise : payment.amount;
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time comparison so signature checks don't leak timing information. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Signature Razorpay Checkout returns to the browser after a successful payment. */
export async function verifyCheckoutSignature(
  orderId: string,
  paymentId: string,
  signature: string,
): Promise<boolean> {
  const expected = await hmacSha256Hex(
    requireEnv("RAZORPAY_KEY_SECRET"),
    `${orderId}|${paymentId}`,
  );
  return safeEqual(expected, signature.toLowerCase());
}

/** X-Razorpay-Signature on webhooks: HMAC of the exact raw request body. */
export async function verifyWebhookSignature(rawBody: string, signature: string): Promise<boolean> {
  const expected = await hmacSha256Hex(requireEnv("RAZORPAY_WEBHOOK_SECRET"), rawBody);
  return safeEqual(expected, signature.toLowerCase());
}

export function publicKeyId(): string {
  return requireEnv("RAZORPAY_KEY_ID");
}
