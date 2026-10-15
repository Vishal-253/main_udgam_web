import { EVENT_CATEGORIES, type EventCategory, type EventCategoryId } from "./data/eventDetails";

export const categoryOf = (id: EventCategoryId): EventCategory =>
  EVENT_CATEGORIES.find((c) => c.id === id) ?? (EVENT_CATEGORIES[0] as EventCategory);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
