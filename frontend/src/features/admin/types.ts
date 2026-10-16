// Shapes returned by the admin API (shared by server and admin UI).

export type RegistrationStatus =
  "pending" | "confirmed" | "expired" | "cancelled" | "refund_required";

export interface AdminMember {
  is_leader: boolean;
  name: string;
  roll_no: string;
  email?: string | null;
  phone?: string | null;
  year?: string | null;
  department?: string | null;
  college?: string | null;
}

export interface AdminRegistration {
  id: string;
  eventId: string;
  eventName: string;
  teamName: string | null;
  status: RegistrationStatus;
  amountPaise: number;
  members: AdminMember[];
  leaderRollNo: string;
  leaderEmail: string;
  leaderPhone: string;
  razorpayOrderId: string | null;
  razorpayPaymentId: string | null;
  createdAt: string;
  confirmedAt: string | null;
  expiresAt: string | null;
}

export interface AdminEventStats {
  eventId: string;
  eventName: string;
  tier: "major" | "regular";
  fee: number;
  feeUnit: "team" | "person" | null;
  teamSize: { min: number; max: number };
  confirmedTeams: number;
  confirmedParticipants: number;
  pendingTeams: number;
  refunds: number;
  revenuePaise: number;
  lastConfirmedAt: string | null;
}

export interface AdminOverview {
  events: AdminEventStats[];
  totals: {
    confirmedTeams: number;
    confirmedParticipants: number;
    uniqueParticipants: number;
    pendingTeams: number;
    revenuePaise: number;
    refunds: number;
  };
  recent: AdminRegistration[];
  refunds: AdminRegistration[];
  backup: { configured: boolean; unsynced: number };
  generatedAt: string;
}

export type AdminResult<T> =
  { ok: true; data: T } | { ok: false; error: "unauthorized" | "error"; message: string };
