import type { TeamMember } from "../data/teamData";
import TeamPassCard from "./TeamPassCard";

/** A titled group of member cards laid out on the page (Conveners, General Secretary). */
export default function CoreTeamSection({
  title,
  members,
  label = title,
}: {
  title: string;
  members: TeamMember[];
  label?: string;
}) {
  if (!members.length) return null;
  return (
    <section className="team-tier-section tier-core-group" aria-label={label}>
      <div className="core-group">
        <h2 className="leadership-role-title">{title}</h2>
        <div className="core-group-cards">
          {members.map((m) => (
            <div key={m.id} className="leadership-card-col">
              <TeamPassCard member={m} hideRoleInside={true} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
