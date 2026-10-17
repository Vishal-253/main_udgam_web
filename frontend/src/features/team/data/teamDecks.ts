import { teamMembers, committeeCategories, committeeMembers, type TeamMember } from "./teamData";

// Leadership groups and committee decks for the team page, derived once from teamData.

export interface CommitteeDeck {
  id: string;
  title: string;
  subtitle: string;
  roleText: string;
  icon: string;
  coverImage: string;
  members: TeamMember[];
}

export interface TeamDirectory {
  president: TeamMember | null;
  vicePresidents: TeamMember[];
  treasurer: TeamMember | null;
  conveners: TeamMember[];
  generalSecretaries: TeamMember[];
  jointSecretaries: TeamMember[];
  committees: CommitteeDeck[];
}

const COVER_DIR = "/assets/team/committees";
// /assets is cached by browsers for a year, so a changed cover needs a new file name
const COVER_FILES: Record<string, string> = {
  publicity: "publicity-v2", // relabelled from "Public Relations"
};

// Dinesh Saini leads the General Secretary row
const GENSEC_FIRST = "dinesh-saini";
/** committee deck shown first in the organising committee section */
const FIRST_COMMITTEE = "web-dev";

const DECK_TITLES: Record<string, string> = {
  "web-dev": "Web Development",
  publicity: "Publicity",
};

export function buildTeamDirectory(): TeamDirectory {
  const byBadge = (badge: TeamMember["badgeType"]) =>
    teamMembers.filter((m) => m.badgeType === badge);

  const generalSecretaries = byBadge("gensec").sort(
    (a, b) => Number(b.id === GENSEC_FIRST) - Number(a.id === GENSEC_FIRST),
  );

  // the 15 operational wings: Web Dev leads, the rest keep their order (Sponsorship onwards)
  const committees = committeeCategories
    .filter((c) => c.id !== "all")
    .sort((a, b) => Number(b.id === FIRST_COMMITTEE) - Number(a.id === FIRST_COMMITTEE))
    .map((cat): CommitteeDeck => {
      const members = committeeMembers.filter((m) => m.committeeId === cat.id);
      const title = DECK_TITLES[cat.id] ?? cat.label;
      return {
        id: cat.id,
        title,
        subtitle: cat.fullName ?? `${title} Committee`,
        roleText: `${members.length} PASSES IN DECK`,
        icon: cat.icon,
        coverImage: `${COVER_DIR}/${COVER_FILES[cat.id] ?? cat.id}.webp`,
        members,
      };
    });

  return {
    president: byBadge("president")[0] ?? null,
    vicePresidents: byBadge("vp"),
    treasurer: byBadge("treasurer")[0] ?? null,
    conveners: byBadge("convener"),
    generalSecretaries,
    // in the order listed in teamData (Anuska Mandal, Sujal Prasad, Mudit Sharma)
    jointSecretaries: byBadge("jointsec"),
    committees,
  };
}
