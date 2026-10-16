import { describe, expect, it } from "vitest";
import { registrationsToCsv } from "@/features/admin/csv";
import type { AdminRegistration } from "@/features/admin/types";

const reg: AdminRegistration = {
  id: "11111111-1111-4111-8111-111111111111",
  eventId: "rangoli",
  eventName: "Rangoli",
  teamName: "Colours",
  status: "confirmed",
  amountPaise: 8000,
  members: [
    {
      is_leader: true,
      name: "Asha Rai",
      roll_no: "B23CS001",
      email: "a@x.in",
      phone: "9876543210",
    },
    { is_leader: false, name: 'Bina "B" Lama', roll_no: "B23CS002" },
  ],
  leaderRollNo: "B23CS001",
  leaderEmail: "a@x.in",
  leaderPhone: "9876543210",
  razorpayOrderId: "order_X",
  razorpayPaymentId: "pay_X",
  createdAt: "2026-10-16T10:00:00.000Z",
  confirmedAt: "2026-10-16T10:05:00.000Z",
  expiresAt: null,
};

describe("admin CSV export", () => {
  it("writes a header plus one row per participant, quoting safely", () => {
    const lines = registrationsToCsv([reg]).split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Leader","Asha Rai","B23CS001"');
    expect(lines[2]).toContain('"Bina ""B"" Lama"');
    expect(lines[1]).toContain('"80"');
  });

  it("neutralises spreadsheet formula injection", () => {
    const csv = registrationsToCsv([{ ...reg, teamName: '=HYPERLINK("http://x")' }]);
    expect(csv).toContain(`"'=HYPERLINK(""http://x"")"`);
    expect(registrationsToCsv([{ ...reg, teamName: "+cmd" }])).toContain(`"'+cmd"`);
  });
});
