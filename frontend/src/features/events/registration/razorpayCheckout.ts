// Browser side of Razorpay Checkout. The script is loaded only when someone actually pays.
// Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

interface RazorpaySuccess {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", cb: (resp: { error?: { description?: string } }) => void) => void;
}

type RazorpayCtor = new (options: Record<string, unknown>) => RazorpayInstance;

let loading: Promise<RazorpayCtor> | null = null;

function loadCheckout(): Promise<RazorpayCtor> {
  const existing = (window as { Razorpay?: RazorpayCtor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onload = () => {
        const ctor = (window as { Razorpay?: RazorpayCtor }).Razorpay;
        if (ctor) resolve(ctor);
        else reject(new Error("Razorpay failed to initialise"));
      };
      s.onerror = () => {
        loading = null; // allow a retry
        s.remove();
        reject(new Error("Couldn't load the payment window. Check your connection."));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export type CheckoutOutcome =
  | { kind: "paid"; orderId: string; paymentId: string; signature: string }
  | { kind: "dismissed" }
  | { kind: "error"; message: string };

export async function payWithRazorpay(opts: {
  keyId: string;
  orderId: string;
  amountPaise: number;
  description: string;
  prefill: { name: string; email: string; contact: string };
  /** close the checkout before the server-side hold runs out */
  timeoutSeconds: number;
}): Promise<CheckoutOutcome> {
  let Razorpay: RazorpayCtor;
  try {
    Razorpay = await loadCheckout();
  } catch (err) {
    return {
      kind: "error",
      message: err instanceof Error ? err.message : "Payment window failed to load.",
    };
  }

  return new Promise<CheckoutOutcome>((resolve) => {
    let settled = false;
    const finish = (o: CheckoutOutcome) => {
      if (!settled) {
        settled = true;
        resolve(o);
      }
    };
    const rzp = new Razorpay({
      key: opts.keyId,
      order_id: opts.orderId,
      amount: opts.amountPaise,
      currency: "INR",
      name: "Udgam 2K26",
      description: opts.description,
      prefill: opts.prefill,
      theme: { color: "#e8547a" },
      timeout: opts.timeoutSeconds,
      retry: { enabled: true },
      handler: (resp: RazorpaySuccess) =>
        finish({
          kind: "paid",
          orderId: resp.razorpay_order_id,
          paymentId: resp.razorpay_payment_id,
          signature: resp.razorpay_signature,
        }),
      modal: { ondismiss: () => finish({ kind: "dismissed" }), confirm_close: true },
    });
    // a failed attempt keeps the checkout open so the user can retry with another method;
    // we only settle when they close it (ondismiss) or succeed (handler)
    rzp.on("payment.failed", () => undefined);
    rzp.open();
  });
}
