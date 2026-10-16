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
  committees: CommitteeDeck[];
}

const COVER_DIR = "/assets/team/committees";

// Dinesh Saini leads the General Secretary row
const GENSEC_FIRST = "dinesh-saini";

const DECK_TITLES: Record<string, string> = {
  "web-dev": "Web Development",
  publicity: "Public Relations",
};

export function buildTeamDirectory(): TeamDirectory {
  const byBadge = (badge: TeamMember["badgeType"]) =>
    teamMembers.filter((m) => m.badgeType === badge);

  const generalSecretaries = byBadge("gensec").sort(
    (a, b) => Number(b.id === GENSEC_FIRST) - Number(a.id === GENSEC_FIRST),
  );

  // the 15 operational wings, starting from Sponsorship
  const committees = committeeCategories
    .filter((c) => c.id !== "all")
    .map((cat): CommitteeDeck => {
      const members = committeeMembers.filter((m) => m.committeeId === cat.id);
      const title = DECK_TITLES[cat.id] ?? cat.label;
      return {
        id: cat.id,
        title,
        subtitle: cat.fullName ?? `${title} Committee`,
        roleText: `${members.length} PASSES IN DECK`,
        icon: cat.icon,
        coverImage: `${COVER_DIR}/${cat.id}.webp`,
        members,
      };
    });

  return {
    president: byBadge("president")[0] ?? null,
    vicePresidents: byBadge("vp"),
    treasurer: byBadge("treasurer")[0] ?? null,
    conveners: byBadge("convener"),
    generalSecretaries,
    committees,
  };
}
