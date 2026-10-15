import { createFileRoute } from "@tanstack/react-router";
import TeamPage from "@/features/team/TeamPage";
import teamCss from "@/features/team/team.css?url";
import { getTeam } from "@/lib/team.functions";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Team — Udgam 2K26" },
      {
        name: "description",
        content:
          "Meet the people behind Udgam 2K26: the core team and the 15 committees of the organising team.",
      },
      { property: "og:title", content: "Team — Udgam 2K26" },
      { property: "og:description", content: "The organising team of Udgam 2K26, NIT Sikkim." },
    ],
    links: [{ rel: "stylesheet", href: teamCss }],
  }),
  loader: () => getTeam(),
  component: Team,
});

function Team() {
  const team = Route.useLoaderData();
  return <TeamPage team={team} />;
}
