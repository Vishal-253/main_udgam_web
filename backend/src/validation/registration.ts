import { z } from "zod";
import type { EventRule } from "../data/events";

// Registration validation — the authoritative check. The website runs a copy of these rules
// (frontend/src/features/events/registration/schema.ts) only for instant form feedback.

export const YEARS = [
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "M.Tech",
  "MSc",
  "PhD",
] as const;

/** Upper-case, strip all whitespace: "  b23 cs 001 " -> "B23CS001" */
export const normalizeRollNo = (v: string) => v.replace(/\s+/g, "").toUpperCase();

/** Accepts 10-digit Indian mobiles with optional +91 / 91 / 0 prefix and separators. */
export const normalizePhone = (v: string) => {
  const digits = v.replace(/[\s()-]/g, "");
  return digits.replace(/^(\+91|91|0)(?=\d{10}$)/, "");
};

const name = z
  .string()
  .trim()
  .min(2, "Enter the full name")
  .max(80, "Name is too long")
  .regex(/^[\p{L}][\p{L} .'-]*$/u, "Use letters only");

const rollNo = z
  .string()
  .transform(normalizeRollNo)
  .pipe(
    z
      .string()
      .min(3, "Enter a valid roll number")
      .max(20, "Roll number is too long")
      .regex(/^[A-Z0-9/-]+$/, "Roll number can only have letters, digits, / and -"),
  );

export const leaderSchema = z.object({
  name,
  rollNo,
  email: z.string().trim().toLowerCase().max(254).email("Enter a valid email"),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit mobile number")),
  year: z.enum(YEARS, { errorMap: () => ({ message: "Select your year" }) }),
  department: z.string().trim().min(2, "Enter your department").max(60),
  college: z.string().trim().min(2, "Enter your college").max(100),
});

export const memberSchema = z.object({ name, rollNo });

export const registrationSchema = z.object({
  eventId: z.string().trim().min(1).max(64),
  teamName: z.string().trim().max(60, "Team name is too long").optional().default(""),
  leader: leaderSchema,
  members: z.array(memberSchema).max(20),
});

export type RegistrationInput = z.input<typeof registrationSchema>;
export type RegistrationData = z.output<typeof registrationSchema>;

/** Team-level rules that depend on the event: exact size and distinct roll numbers. */
export function teamProblems(event: EventRule, data: RegistrationData): string[] {
  const problems: string[] = [];
  const size = 1 + data.members.length;
  const { min, max } = event.teamSize;
  if (size < min || size > max) {
    problems.push(
      min === max
        ? `${event.name} needs exactly ${min} participant${min === 1 ? "" : "s"} (including the leader).`
        : `${event.name} needs ${min} to ${max} participants (including the leader).`,
    );
  }
  const rolls = [data.leader.rollNo, ...data.members.map((m) => m.rollNo)];
  const dupes = [...new Set(rolls.filter((r, i) => rolls.indexOf(r) !== i))];
  if (dupes.length) {
    problems.push(
      `Each participant must be a different person. Repeated roll number: ${dupes.join(", ")}.`,
    );
  }
  // a team name is needed only when more than one person registers (a solo dancer needs none)
  if (size > 1 && !data.teamName) problems.push("Enter a team name.");
  return problems;
}

/** Amount in paise, computed only from the event config (never from the client). */
export function amountPaise(event: EventRule, teamSize: number): number {
  // events whose fee isn't announced (null) are refused before this is called
  const perUnit = (event.fee ?? 0) * 100;
  return event.feeUnit === "person" ? perUnit * teamSize : perUnit;
}
