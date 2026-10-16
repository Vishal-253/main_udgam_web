import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RegisterButton } from "@/features/events/components/EventBits";
import RegistrationModal from "@/features/events/components/RegistrationModal";
import { EVENTS } from "@/features/events/data/eventDetails";

vi.mock("qrcode", () => ({
  default: { toDataURL: vi.fn(async () => "data:image/png;base64,QR") },
}));

const receipt = {
  registrationId: "6f1c2b3a-1111-4111-8111-111111111111",
  eventId: "rangoli",
  eventName: "Rangoli",
  teamName: "Colours",
  status: "confirmed",
  amountPaise: 8000,
  members: [
    { name: "Asha Rai", rollNo: "B23CS001", isLeader: true },
    { name: "Bina Lama", rollNo: "B23CS002", isLeader: false },
    { name: "Chen Rai", rollNo: "B23CS003", isLeader: false },
    { name: "Dawa Sherpa", rollNo: "B23CS004", isLeader: false },
  ],
  leaderEmail: "as***@example.com",
  leaderPhone: "******3210",
  paymentId: "pay_ABC123xyz",
  createdAt: "2026-10-16T10:00:00.000Z",
  confirmedAt: "2026-10-16T10:05:00.000Z",
};

vi.mock("@/features/events/registration/api", () => ({
  getRegistrationReceipt: vi.fn(async () => receipt),
  getRegistrationStatus: vi.fn(),
  startEventRegistration: vi.fn(),
  verifyEventPayment: vi.fn(),
  cancelPendingRegistration: vi.fn(),
}));

const rangoli = EVENTS.find((e) => e.id === "rangoli")!;

describe("Register button", () => {
  it("says Register and calls onRegister directly (no cart)", () => {
    const onRegister = vi.fn();
    render(<RegisterButton registered={false} onRegister={onRegister} eventName="Rangoli" />);
    const btn = screen.getByRole("button", { name: "Register for Rangoli" });
    expect(btn).toHaveTextContent("Register");
    fireEvent.click(btn);
    expect(onRegister).toHaveBeenCalledTimes(1);
  });

  it("shows Registered once registered", () => {
    render(<RegisterButton registered onRegister={() => {}} eventName="Rangoli" />);
    expect(screen.getByRole("button", { name: /receipt/i })).toHaveTextContent("Registered");
  });
});

describe("registration form", () => {
  it("opens straight on the form with the right number of member rows", () => {
    render(<RegistrationModal event={rangoli} onClose={() => {}} onRegistered={() => {}} />);
    expect(screen.getByRole("heading", { name: "Register for Rangoli" })).toBeInTheDocument();
    // Rangoli = exactly 4 (leader + 3 members)
    expect(screen.getAllByText("Name")).toHaveLength(3);
    expect(screen.queryByText("+ Add member")).not.toBeInTheDocument();
  });
});

describe("receipt", () => {
  it("shows event, team, members, amount, payment, receipt number and QR", async () => {
    render(
      <RegistrationModal
        event={rangoli}
        receiptId={receipt.registrationId}
        onClose={() => {}}
        onRegistered={() => {}}
      />,
    );
    expect(await screen.findByText("Team “Colours”")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /You're in — Rangoli/ })).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("#6F1C2B3A")).toBeInTheDocument();
    expect(screen.getByText("₹80")).toBeInTheDocument();
    expect(screen.getByText("pay_ABC123xyz")).toBeInTheDocument();
    for (const m of receipt.members) expect(screen.getByText(m.rollNo)).toBeInTheDocument();
    expect(screen.getByText("Leader")).toBeInTheDocument();
    expect(await screen.findByAltText(/Check-in QR code/)).toHaveAttribute(
      "src",
      "data:image/png;base64,QR",
    );
    expect(screen.getByRole("button", { name: "Print / Save as PDF" })).toBeInTheDocument();
  });

  it("'Register another team' opens a fresh form", async () => {
    render(
      <RegistrationModal
        event={rangoli}
        receiptId={receipt.registrationId}
        onClose={() => {}}
        onRegistered={() => {}}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Register another team" }));
    expect(screen.getByRole("heading", { name: "Register for Rangoli" })).toBeInTheDocument();
  });
});
