import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { EVENTS, EVENT_CATEGORIES } from "@/features/events/data/eventDetails";

// Backend API for the events page. Data is static for now; this is where a database plugs in.

export const getEventCatalog = createServerFn({ method: "GET" }).handler(async () => ({
  categories: EVENT_CATEGORIES,
  events: EVENTS,
}));

export type RegistrationResult =
  | { ok: true; status: "registered"; message: string }
  | { ok: false; status: "not-open" | "invalid"; message: string };

const knownIds = new Set(EVENTS.map((e) => e.id));

/** Register for the events on a visitor's pass. Registrations are not open yet. */
export const registerForEvents = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        eventIds: z.array(z.string().trim().min(1).max(64)).min(1).max(EVENTS.length),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<RegistrationResult> => {
    const unknown = data.eventIds.filter((id) => !knownIds.has(id));
    if (unknown.length) {
      return {
        ok: false,
        status: "invalid",
        message: "Some of those events no longer exist. Please refresh.",
      };
    }
    // TODO: persist the registration (and take payment) once registrations open.
    return {
      ok: false,
      status: "not-open",
      message: "Registrations open soon. Your picks are saved on this device.",
    };
  });
