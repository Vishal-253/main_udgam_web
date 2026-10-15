import { createServerFn } from "@tanstack/react-start";
import { buildTeamDirectory } from "@/features/team/data/teamDecks";

// Backend API for the team page. Data is static for now; this is where a database plugs in.

export const getTeam = createServerFn({ method: "GET" }).handler(async () => buildTeamDirectory());
