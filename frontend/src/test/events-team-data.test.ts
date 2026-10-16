import { describe, expect, it } from "vitest";

import { EVENTS, EVENT_CATEGORIES, cardTaglines } from "@/features/events/data/eventDetails";
import { buildTeamDirectory } from "@/features/team/data/teamDecks";
import { teamMembers, committeeMembers } from "@/features/team/data/teamData";

describe("events data", () => {
  it("has unique ids and a known category for every event", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(EVENT_CATEGORIES.map((c) => c.id));
    for (const e of EVENTS) expect(categories.has(e.category)).toBe(true);
  });

  it("lists each e-sports title as its own event with the budget fee", () => {
    const esports = EVENTS.filter((e) => e.category === "esports");
    expect(esports.map((e) => e.name).sort()).toEqual(
      ["BGMI", "Free Fire", "MLBB", "eFootball"].sort(),
    );
    for (const e of esports) {
      expect(e.fee).toBe(e.id === "efootball" ? 50 : 200);
      expect(cardTaglines(e).length).toBeGreaterThan(0);
    }
  });
});

describe("team directory", () => {
  const team = buildTeamDirectory();

  it("finds the leadership", () => {
    expect(team.president?.role).toBe("President");
    expect(team.vicePresidents).toHaveLength(2);
    expect(team.treasurer?.role).toBe("Treasurer");
    expect(team.conveners).toHaveLength(2);
  });

  it("puts Dinesh Saini first among the General Secretaries", () => {
    expect(team.generalSecretaries[0]?.id).toBe("dinesh-saini");
    expect(team.generalSecretaries).toHaveLength(6);
  });

  it("builds the 15 committee decks with every committee member and a cover", () => {
    expect(team.committees).toHaveLength(15);
    const dealt = team.committees.reduce((n, d) => n + d.members.length, 0);
    expect(dealt).toBe(committeeMembers.length);
    for (const d of team.committees) {
      expect(d.coverImage).toBe(`/assets/team/committees/${d.id}.webp`);
    }
  });

  it("has unique member ids", () => {
    const ids = [...teamMembers, ...committeeMembers].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
