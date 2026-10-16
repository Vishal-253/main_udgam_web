import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// Backend API for Udgam 2K26 — stubbed data, ready to swap for a database.
// Events live in events.functions.ts and the team in team.functions.ts.
const SCHEDULE = [
  { day: 1, label: "Day 1 · Bloom", items: ["Opening Ceremony", "Sakura Hack begins", "Makers' Workshops"] },
  { day: 2, label: "Day 2 · Breeze", items: ["Petal Dance-Off", "Lantern Art Walk", "Food Carnival"] },
  { day: 3, label: "Day 3 · Glow", items: ["Whimsy Theatre", "Prize Ceremony", "Headliner Night"] },
];

export const getSchedule = createServerFn({ method: "GET" }).handler(async () => SCHEDULE);

export const submitContact = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().email().max(255),
      message: z.string().trim().min(1).max(1000),
    }).parse(d),
  )
  .handler(async ({ data }) => ({ ok: true, received: data.name }));
