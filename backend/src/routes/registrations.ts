import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { verifyCheckoutSignature } from "../services/razorpay";
import {
  cancelPending,
  confirmPaidOrder,
  registrationStatus,
  startRegistration,
} from "../services/registrations";
import { normalizeRollNo } from "../validation/registration";

// Public registration API used by the events page.
//   POST /api/registrations                 start: validate team, hold spots, create order
//   POST /api/registrations/verify-payment  Razorpay Checkout success callback
//   POST /api/registrations/cancel          leader releases an unpaid registration
//   GET  /api/registrations/:id/status      status only (no personal data)

export const registrationsRouter = Router();

const startLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, code: "error", message: "Too many attempts. Please wait a few minutes." },
});
const followUpLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { ok: false, code: "error", message: "Too many requests. Please wait a few minutes." },
});

registrationsRouter.post("/", startLimiter, async (req, res) => {
  try {
    res.json(await startRegistration(req.body));
  } catch (err) {
    console.error("[registration] start failed", err);
    res.status(500).json({
      ok: false,
      code: "error",
      message: "Something went wrong on our side. Please try again.",
    });
  }
});

const paymentInput = z.object({
  orderId: z.string().regex(/^order_[A-Za-z0-9]{6,40}$/),
  paymentId: z.string().regex(/^pay_[A-Za-z0-9]{6,40}$/),
  signature: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

registrationsRouter.post("/verify-payment", followUpLimiter, async (req, res) => {
  const parsed = paymentInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, code: "invalid", message: "Invalid payment details." });
    return;
  }
  const { orderId, paymentId, signature } = parsed.data;
  try {
    if (!(await verifyCheckoutSignature(orderId, paymentId, signature))) {
      console.warn("[registration] bad checkout signature", orderId);
      res.json({ ok: false, code: "invalid", message: "We couldn't verify this payment." });
      return;
    }
    res.json(await confirmPaidOrder(orderId, paymentId));
  } catch (err) {
    console.error("[registration] verify failed", orderId, err);
    res.json({
      ok: false,
      code: "error",
      message:
        "We couldn't confirm your payment right now. If money was deducted, your registration will be " +
        "confirmed automatically within a few minutes — no need to pay again.",
    });
  }
});

const cancelInput = z.object({
  registrationId: z.string().uuid(),
  leaderRollNo: z.string().min(1).max(40),
});

registrationsRouter.post("/cancel", followUpLimiter, async (req, res) => {
  const parsed = cancelInput.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ status: "invalid" });
    return;
  }
  try {
    const status = await cancelPending(
      parsed.data.registrationId,
      normalizeRollNo(parsed.data.leaderRollNo),
    );
    res.json({ status });
  } catch (err) {
    console.error("[registration] cancel failed", parsed.data.registrationId, err);
    res.status(500).json({ status: "error" });
  }
});

registrationsRouter.get("/:id/status", followUpLimiter, async (req, res) => {
  const id = z.string().uuid().safeParse(req.params["id"]);
  if (!id.success) {
    res.status(400).json(null);
    return;
  }
  try {
    res.json(await registrationStatus(id.data));
  } catch (err) {
    console.error("[registration] status failed", id.data, err);
    res.status(500).json(null);
  }
});
