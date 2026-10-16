import { createServerFn } from "@tanstack/react-start";
import { EVENTS, EVENT_CATEGORIES } from "@/features/events/data/eventDetails";

// Event catalogue for the events page. Registration + payment is served by the backend/ API.

export const getEventCatalog = createServerFn({ method: "GET" }).handler(async () => ({
  categories: EVENT_CATEGORIES,
  events: EVENTS,
}));
