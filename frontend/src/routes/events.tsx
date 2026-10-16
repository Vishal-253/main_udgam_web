import { createFileRoute } from "@tanstack/react-router";
import EventsPage from "@/features/events/EventsPage";
import eventsCss from "@/features/events/events.css?url";
import { getEventCatalog } from "@/lib/events.functions";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Udgam 2K26" },
      {
        name: "description",
        content:
          "26 events across games, sport, performance, food and e-sports at Udgam 2K26. Pick your stage.",
      },
      { property: "og:title", content: "Events — Udgam 2K26" },
      {
        property: "og:description",
        content: "Pick your stage: every event at Udgam 2K26, NIT Sikkim.",
      },
    ],
    links: [{ rel: "stylesheet", href: eventsCss }],
  }),
  loader: () => getEventCatalog(),
  component: Events,
});

function Events() {
  const { events, categories } = Route.useLoaderData();
  return <EventsPage events={events} categories={categories} />;
}
