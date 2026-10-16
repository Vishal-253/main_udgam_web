import { apiFetch } from "@/lib/api";
import type { RegistrationInput } from "./schema";

// Registration endpoints of the backend (backend/src/routes/registrations.ts).

export type Conflict = { rollNo: string; pending: boolean };

export type StartRegistrationResult =
  | { ok: true; status: "confirmed"; registrationId: string; eventName: string }
  | {
      ok: true;
      status: "payment_required";
      registrationId: string;
      eventName: string;
      holdMinutes: number;
      order: { id: string; amount: number; currency: "INR"; keyId: string };
      prefill: { name: string; email: string; contact: string };
    }
  | {
      ok: false;
      code: "closed" | "invalid" | "conflict" | "error";
      message: string;
      problems?: string[];
      conflicts?: Conflict[];
    };

export type PaymentResult =
  | { ok: true; status: "confirmed"; registrationId: string }
  | {
      ok: false;
      code: "invalid" | "refund_required" | "not_found" | "error";
      message: string;
    };

export const startEventRegistration = ({ data }: { data: RegistrationInput }) =>
  apiFetch<StartRegistrationResult>("/api/registrations", { body: data });

export const verifyEventPayment = ({
  data,
}: {
  data: { orderId: string; paymentId: string; signature: string };
}) => apiFetch<PaymentResult>("/api/registrations/verify-payment", { body: data });

export const cancelPendingRegistration = ({
  data,
}: {
  data: { registrationId: string; leaderRollNo: string };
}) => apiFetch<{ status: string }>("/api/registrations/cancel", { body: data });

export const getRegistrationStatus = ({ data }: { data: { registrationId: string } }) =>
  apiFetch<{ status: string; eventId: string } | null>(
    `/api/registrations/${encodeURIComponent(data.registrationId)}/status`,
  );

export interface RegistrationReceipt {
  registrationId: string;
  eventId: string;
  eventName: string;
  teamName: string | null;
  status: string;
  amountPaise: number;
  members: { name: string; rollNo: string; isLeader: boolean }[];
  leaderEmail: string;
  leaderPhone: string;
  paymentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
}

export const getRegistrationReceipt = (registrationId: string) =>
  apiFetch<RegistrationReceipt | null>(
    `/api/registrations/${encodeURIComponent(registrationId)}/receipt`,
  );
