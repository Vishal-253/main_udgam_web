// The website shows fees and team sizes from the frontend's event list; the server charges and
// validates from backend/src/data/events.ts. This test fails if the two ever disagree.
import { describe, expect, it } from "vitest";
import { EVENTS as FRONTEND_EVENTS } from "../../frontend/src/features/events/data/eventDetails";
import { EVENTS } from "../src/data/events";

describe("event rules match the website", () => {
  it("has exactly the same events", () => {
    expect(EVENTS.map((e) => e.id).sort()).toEqual(FRONTEND_EVENTS.map((e) => e.id).sort());
  });

  it("has the same name, fee, fee unit and team size for every event", () => {
    for (const fe of FRONTEND_EVENTS) {
      const be = EVENTS.find((e) => e.id === fe.id);
      expect(be, fe.id).toBeDefined();
      expect(
        { name: be?.name, fee: be?.fee, feeUnit: be?.feeUnit, teamSize: be?.teamSize },
        fe.id,
      ).toEqual({ name: fe.name, fee: fe.fee, feeUnit: fe.feeUnit ?? null, teamSize: fe.teamSize });
    }
  });
});
