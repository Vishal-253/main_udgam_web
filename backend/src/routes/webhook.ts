import express, { Router } from "express";
import { syncPending } from "../services/backup";
import { verifyWebhookSignature } from "../services/razorpay";
import { confirmPaidOrder } from "../services/registrations";

// POST /api/razorpay/webhook
// Configure in Razorpay Dashboard -> Webhooks with events: payment.authorized, payment.captured,
// order.paid, and the same secret as RAZORPAY_WEBHOOK_SECRET.
// Safety net for payments where the browser never reported back (tab closed, network drop).
// confirmPaidOrder is idempotent, so duplicates and retries are harmless.

const HANDLED = new Set(["payment.authorized", "payment.captured", "order.paid"]);

interface WebhookBody {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string | null } };
    order?: { entity?: { id?: string } };
  };
}

export const webhookRouter = Router();

// the signature covers the exact raw bytes, so this route must NOT use the JSON parser
webhookRouter.post("/", express.raw({ type: "*/*", limit: "256kb" }), async (req, res) => {
  const signature = req.get("x-razorpay-signature");
  if (!signature) {
    res.status(400).type("text").send("missing signature");
    return;
  }
  const raw = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : "";

  let valid = false;
  try {
    valid = await verifyWebhookSignature(raw, signature);
  } catch (err) {
    console.error("[webhook] signature check failed (is RAZORPAY_WEBHOOK_SECRET set?)", err);
    res.status(500).type("text").send("server misconfigured");
    return;
  }
  if (!valid) {
    console.warn("[webhook] invalid signature");
    res.status(401).type("text").send("invalid signature");
    return;
  }

  let body: WebhookBody;
  try {
    body = JSON.parse(raw) as WebhookBody;
  } catch {
    res.status(400).type("text").send("bad json");
    return;
  }
  if (!body.event || !HANDLED.has(body.event)) {
    res.type("text").send("ignored");
    return;
  }

  const payment = body.payload?.payment?.entity;
  const orderId = payment?.order_id ?? body.payload?.order?.entity?.id;
  const paymentId = payment?.id;
  if (!orderId || !paymentId) {
    res.type("text").send("ignored: no order/payment id");
    return;
  }

  try {
    const result = await confirmPaidOrder(orderId, paymentId);
    // piggy-back: back up a few registrations that changed without a request (expired holds)
    await syncPending(3).catch((err) => console.error("[webhook] backup sweep failed", err));
    if (result.ok) {
      res.type("text").send("confirmed");
      return;
    }
    // not_found = a payment for something other than event registration: nothing to do.
    // refund_required is final and already logged for the organisers.
    if (result.code === "not_found" || result.code === "refund_required") {
      res.type("text").send(result.code);
      return;
    }
    // "invalid" (e.g. capture not finished yet) or "error": ask Razorpay to retry later
    res.status(500).type("text").send("retry");
  } catch (err) {
    console.error("[webhook] confirm failed", orderId, paymentId, err);
    res.status(500).type("text").send("retry");
  }
});
