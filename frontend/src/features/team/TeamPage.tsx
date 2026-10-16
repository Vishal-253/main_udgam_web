import { useState } from "react";
import type { CommitteeDeck, TeamDirectory } from "./data/teamDecks";
import TeamBackdrop from "./components/TeamBackdrop";
import LeadershipSection from "./components/LeadershipSection";
import CoreTeamSection from "./components/CoreTeamSection";
import OrganisingCommitteeSection from "./components/OrganisingCommitteeSection";
import TeamCardDeck from "./components/TeamCardDeck";
import TeamDeckOverlay from "./components/TeamDeckOverlay";
import TiltPrompt from "./components/TiltPrompt";

export default function TeamPage({ team }: { team: TeamDirectory }) {
  // committee deck currently dealt out in the overlay
  const [activeDeck, setActiveDeck] = useState<CommitteeDeck | null>(null);

  const renderDeck = (deck: CommitteeDeck) => (
    <TeamCardDeck
      key={deck.id}
      id={deck.id}
      title={deck.title}
      coverImage={deck.coverImage}
      memberCount={deck.members.length}
      isOpen={activeDeck?.id === deck.id}
      onToggle={() => setActiveDeck(deck)}
    />
  );

  return (
    <div className={`udgam-team team-page-root ${activeDeck ? "team-page-has-deck-overlay" : ""}`}>
      <TeamBackdrop />

      <main className="team-hierarchical-layout">
        <LeadershipSection
          president={team.president}
          vicePresidents={team.vicePresidents}
          treasurer={team.treasurer}
        />
        <CoreTeamSection title="Conveners" members={team.conveners} />
        <CoreTeamSection
          title="General Secretary"
          label="General Secretaries"
          members={team.generalSecretaries}
        />
        <OrganisingCommitteeSection decks={team.committees} renderDeck={renderDeck} />
      </main>

      {/* Deals the chosen committee's cards over the translucent page */}
      {activeDeck && <TeamDeckOverlay deck={activeDeck} onClose={() => setActiveDeck(null)} />}

      <TiltPrompt />
    </div>
  );
}
