import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { EVENTS, EVENT_CATEGORIES } from "@/features/events/data/eventDetails";
import { buildTeamDirectory } from "@/features/team/data/teamDecks";
import { teamMembers, committeeMembers } from "@/features/team/data/teamData";
import { teamPhotoFor } from "@/features/team/lib/teamPhotos";

describe("events data", () => {
  it("has unique ids and a known category for every event", () => {
    const ids = EVENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const categories = new Set(EVENT_CATEGORIES.map((c) => c.id));
    for (const e of EVENTS) expect(categories.has(e.category)).toBe(true);
  });

  it("has the fees from the event-management sheet", () => {
    const byId = (id: string) => EVENTS.find((e) => e.id === id);
    expect(byId("treasure-hunt")).toMatchObject({ fee: 250, feeUnit: "team" });
    expect(byId("squid-games")).toMatchObject({ fee: 30, feeUnit: "person" });
    expect(byId("dance-competition")?.fee).toBe(0);
    expect(byId("food-fiesta")?.fee).toBe(0); // no fee in the budget sheet -> free (organisers' call)
  });

  it("links a rulebook PDF that really exists (and is compressed) for 25 events", () => {
    const withBook = EVENTS.filter((e) => e.rulebookPdf);
    expect(withBook).toHaveLength(25);
    for (const e of withBook) {
      const file = resolve(__dirname, "../../public", `.${e.rulebookPdf}`);
      expect(existsSync(file), e.rulebookPdf).toBe(true);
      expect(statSync(file).size, e.rulebookPdf).toBeLessThan(3 * 1024 * 1024);
    }
  });

  it("only gives a fee unit to paid events, and no negative fees", () => {
    for (const e of EVENTS) {
      if (e.fee !== null) expect(e.fee).toBeGreaterThanOrEqual(0);
      if (e.feeUnit) expect(e.fee).toBeGreaterThan(0);
    }
  });

  it("lists each e-sports title as its own event", () => {
    const esports = EVENTS.filter((e) => e.category === "esports");
    expect(esports.map((e) => e.name)).toEqual(["Free Fire", "BGMI", "MLBB", "eFootball"]);
    for (const e of esports.filter((x) => x.id !== "efootball")) {
      expect(e).toMatchObject({ fee: 200, feeUnit: "team" });
    }
    expect(EVENTS.find((e) => e.id === "efootball")).toMatchObject({ fee: 50, feeUnit: "person" });
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

  it("has three Joint Secretaries in order, each with their own photo", () => {
    expect(team.jointSecretaries.map((m) => m.name)).toEqual([
      "Anuska Mandal",
      "Sujal Prasad",
      "Mudit Sharma",
    ]);
    for (const m of team.jointSecretaries) {
      expect(m.role).toBe("Joint Secretary");
      expect(teamPhotoFor(m.id), m.id).toMatch(/jointsec-/);
    }
    // their committee cards keep the committee photo
    expect(teamPhotoFor("anuska-mandal")).toMatch(/anuska-mandal/);
    expect(teamPhotoFor("anuska-mandal")).not.toMatch(/jointsec-/);
  });

  it("shows the Web Dev committee first, others in their usual order", () => {
    expect(team.committees[0]?.id).toBe("web-dev");
    expect(team.committees[1]?.id).toBe("sponsorship");
    expect(new Set(team.committees.map((d) => d.id)).size).toBe(15);
  });

  it("has unique member ids", () => {
    const ids = [...teamMembers, ...committeeMembers].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
