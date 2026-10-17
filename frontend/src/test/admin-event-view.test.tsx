import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminPage from "@/features/admin/AdminPage";
import type { AdminOverview, AdminRegistration, AdminResult } from "@/features/admin/types";

const registration = (id: string, teamName: string, status: AdminRegistration["status"]) => ({
  id,
  eventId: "rangoli",
  eventName: "Rangoli",
  teamName,
  status,
  amountPaise: 8000,
  members: [{ is_leader: true, name: "Asha Rai", roll_no: `B23${id}` }],
  leaderRollNo: `B23${id}`,
  leaderEmail: "asha@example.com",
  leaderPhone: "9876543210",
  razorpayOrderId: null,
  razorpayPaymentId: null,
  createdAt: "2026-10-16T10:00:00.000Z",
  confirmedAt: null,
  expiresAt: null,
});

const overview: AdminOverview = {
  events: [
    {
      eventId: "rangoli",
      eventName: "Rangoli",
      tier: "regular",
      fee: 80,
      feeUnit: "team",
      teamSize: { min: 4, max: 4 },
      confirmedTeams: 1,
      confirmedParticipants: 4,
      pendingTeams: 1,
      refunds: 0,
      revenuePaise: 8000,
      lastConfirmedAt: null,
    },
  ],
  totals: {
    confirmedTeams: 1,
    confirmedParticipants: 4,
    uniqueParticipants: 4,
    pendingTeams: 1,
    revenuePaise: 8000,
    refunds: 0,
  },
  recent: [],
  refunds: [],
  backup: { configured: true, unsynced: 0 },
  generatedAt: "2026-10-16T10:00:00.000Z",
};

// each status request waits until the test answers it, so answers can arrive out of order
const answers = new Map<string, (rows: AdminRegistration[]) => void>();

vi.mock("@/features/admin/api", () => ({
  getAdminSession: vi.fn(async () => ({ username: "admin" })),
  getAdminOverview: vi.fn(async () => ({ ok: true, data: overview })),
  getAdminEventRegistrations: vi.fn(
    ({ data }: { data: { status: string } }) =>
      new Promise<AdminResult<AdminRegistration[]>>((resolve) =>
        answers.set(data.status, (rows) => resolve({ ok: true, data: rows })),
      ),
  ),
  searchAdminRegistrations: vi.fn(),
  runAdminBackupSync: vi.fn(),
  loginAdmin: vi.fn(),
  logoutAdmin: vi.fn(),
}));

describe("admin event view", () => {
  it("keeps the list of the selected status when an older request answers last", async () => {
    render(<AdminPage />);
    fireEvent.click(await screen.findByRole("button", { name: "Rangoli" }));
    fireEvent.change(screen.getByDisplayValue("Confirmed"), { target: { value: "pending" } });

    await act(async () =>
      answers.get("pending")?.([registration("P1", "Waiting Team", "pending")]),
    );
    await act(async () =>
      answers.get("confirmed")?.([registration("C1", "Paid Team", "confirmed")]),
    );

    expect(screen.getAllByText("Waiting Team").length).toBeGreaterThan(0);
    expect(screen.queryByText("Paid Team")).not.toBeInTheDocument();
  });
});
