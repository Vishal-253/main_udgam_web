// Official team sizes from the organisers (leader included). Every event must accept exactly
// min..max participants — one fewer or one more is refused — and every person in a team must be
// different. One-team-per-event (but free to join other events) is checked against a real
// database in db.integration.test.ts.
import { describe, expect, it } from "vitest";
import { EVENTS } from "../src/data/events";
import { registrationSchema, teamProblems } from "../src/validation/registration";

const OFFICIAL: Record<string, [number, number]> = {
  antakshari: [5, 5], // exactly 5 per team
  "balloon-burst": [2, 2],
  "balloon-pair-race": [2, 2], // Balloon Between Knees Race
  "cup-pong": [1, 1],
  "dance-competition": [1, 7], // maximum 7
  "dumb-charades": [4, 4],
  "fill-and-burst": [4, 5],
  "food-eating-challenge": [1, 1],
  "food-fiesta": [3, 5],
  "free-fire": [4, 4], // 4 main players
  "guess-the-juice": [1, 1],
  housie: [1, 1],
  "ipl-auction": [4, 6],
  mlbb: [5, 6], // 5 players + 1 optional substitute
  photography: [1, 1],
  rangoli: [4, 4],
  "short-movie": [1, 3],
  "singing-competition": [1, 1],
  "spoil-the-tshirt": [3, 3],
  "squid-games": [1, 1],
  "string-maze": [1, 1],
  "three-leg-tie": [2, 2],
  "treasure-hunt": [3, 3],
  "wall-painting": [1, 5], // maximum 5
};

const leader = {
  name: "Asha Rai",
  rollNo: "B23LD001",
  email: "asha@example.com",
  phone: "9876543210",
  year: "2nd Year",
  department: "CSE",
  college: "NIT Sikkim",
};
const NAMES = ["Bina", "Chen", "Dawa", "Esha", "Farah", "Gita", "Hari", "Indu"];

/** Problems for a team of `size` people (leader + distinct members). */
function problemsFor(eventId: string, size: number): string[] {
  const event = EVENTS.find((e) => e.id === eventId);
  if (!event) throw new Error(eventId);
  const members = Array.from({ length: size - 1 }, (_, i) => ({
    name: `${NAMES[i]} Lama`,
    rollNo: `B23MB${String(i).padStart(3, "0")}`,
  }));
  const data = registrationSchema.parse({ eventId, teamName: "Blossoms", leader, members });
  return teamProblems(event, data);
}

describe("official team sizes", () => {
  it("covers all 24 events from the organisers' list (BGMI dropped)", () => {
    expect(Object.keys(OFFICIAL)).toHaveLength(24);
    for (const [id, [min, max]] of Object.entries(OFFICIAL)) {
      expect(EVENTS.find((e) => e.id === id)?.teamSize, id).toEqual({ min, max });
    }
  });

  it.each(Object.entries(OFFICIAL))("%s accepts only %j participants", (id, [min, max]) => {
    expect(problemsFor(id, min), `${id} at min`).toEqual([]);
    expect(problemsFor(id, max), `${id} at max`).toEqual([]);
    if (min > 1) expect(problemsFor(id, min - 1).join(" "), `${id} below min`).toMatch(/needs/);
    expect(problemsFor(id, max + 1).join(" "), `${id} above max`).toMatch(/needs/);
  });
});

describe("distinct members", () => {
  it("refuses the same person twice in one team, however the roll number is typed", () => {
    const event = EVENTS.find((e) => e.id === "rangoli")!;
    const data = registrationSchema.parse({
      eventId: "rangoli",
      teamName: "Colours",
      leader,
      members: [
        { name: "Bina Lama", rollNo: "B23MB001" },
        { name: "Chen Rai", rollNo: " b23 mb001 " }, // same person as Bina, typed differently
        { name: "Asha Again", rollNo: "b23ld001" }, // same person as the leader
      ],
    });
    const problems = teamProblems(event, data).join(" ");
    expect(problems).toMatch(/different person/);
    expect(problems).toContain("B23MB001");
    expect(problems).toContain("B23LD001");
  });

  it("solo entries in a team event need no team name, real teams do", () => {
    expect(
      teamProblems(
        EVENTS.find((e) => e.id === "dance-competition")!,
        registrationSchema.parse({ eventId: "dance-competition", teamName: "", leader, members: [] }),
      ),
    ).toEqual([]);
    expect(
      teamProblems(
        EVENTS.find((e) => e.id === "three-leg-tie")!,
        registrationSchema.parse({
          eventId: "three-leg-tie",
          teamName: "",
          leader,
          members: [{ name: "Bina Lama", rollNo: "B23MB001" }],
        }),
      ),
    ).toContain("Enter a team name.");
  });
});
