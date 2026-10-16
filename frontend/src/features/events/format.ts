import type { FestEvent } from "./data/eventDetails";

export const formatAmount = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;

/** "₹150", "Free" or "TBA" (fee not announced yet) */
export const formatFee = (fee: number | null) =>
  fee === null ? "TBA" : fee === 0 ? "Free" : formatAmount(fee);

/** Short label for what the fee covers: "per team", "free entry", "to be announced"… */
export const feeLabel = (event: Pick<FestEvent, "fee" | "feeUnit">) => {
  if (event.fee === null) return "to be announced";
  if (event.fee === 0) return "free entry";
  return event.feeUnit ? `per ${event.feeUnit}` : "entry";
};

/** Compact pill text: "₹150 / team", "Free", "TBA" */
export const feePill = (event: Pick<FestEvent, "fee" | "feeUnit">) =>
  event.fee && event.feeUnit
    ? `${formatAmount(event.fee)} / ${event.feeUnit}`
    : formatFee(event.fee);
