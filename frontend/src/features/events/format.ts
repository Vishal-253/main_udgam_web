export const formatFee = (amount: number) =>
  amount === 0 ? "Free" : `₹${amount.toLocaleString("en-IN")}`;

/** "per team" / "per person" suffix for a fee; empty for free events */
export const feeUnitLabel = (event: { fee: number; feeUnit?: "team" | "person" }) =>
  event.fee > 0 && event.feeUnit ? `per ${event.feeUnit}` : "";
