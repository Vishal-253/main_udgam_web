import type { AdminRegistration } from "./types";

// CSV export of registrations (one row per participant), Excel-friendly.

/** Quote a CSV cell and neutralise spreadsheet formula injection (=, +, -, @ at the start). */
function cell(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleString("en-IN") : "");

export function registrationsToCsv(rows: AdminRegistration[]): string {
  const header = [
    "Registration ID",
    "Event",
    "Team",
    "Status",
    "Role",
    "Name",
    "Roll No",
    "Email",
    "Phone",
    "Year",
    "Department",
    "College",
    "Amount (Rs)",
    "Payment ID",
    "Registered At",
    "Confirmed At",
  ];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    for (const m of r.members) {
      lines.push(
        [
          r.id,
          r.eventName,
          r.teamName ?? "",
          r.status,
          m.is_leader ? "Leader" : "Member",
          m.name,
          m.roll_no,
          m.email ?? "",
          m.phone ?? "",
          m.year ?? "",
          m.department ?? "",
          m.college ?? "",
          r.amountPaise / 100,
          r.razorpayPaymentId ?? "",
          fmt(r.createdAt),
          fmt(r.confirmedAt),
        ]
          .map(cell)
          .join(","),
      );
    }
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename: string, csv: string) {
  // BOM so Excel opens UTF-8 names correctly
  const blob = new Blob(["﻿", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
