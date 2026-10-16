/**
 * A committee shown as a physical deck: artwork cover on two stacked cards that fan on hover.
 * Activating it deals the committee's cards in the overlay.
 */
export default function TeamCardDeck({
  id,
  title,
  coverImage,
  memberCount,
  isOpen = false,
  onToggle,
}: {
  id: string;
  title: string;
  coverImage: string;
  memberCount: number;
  isOpen?: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className={`team-deck-container ${isOpen ? "deck-active-open" : "deck-collapsed"}`}
      id={`deck-${id}`}
    >
      <div
        className={`team-deck-stack has-cover-image ${isOpen ? "deck-stack-active-state" : ""}`}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-label={`Open ${title} card deck with ${memberCount} passes`}
        title={`Click to open ${title} deck (${memberCount} passes)`}
      >
        <div className="deck-behind-glow" aria-hidden="true" />

        {/* two stacked cards behind the cover */}
        <div className="deck-card-layer layer-back" aria-hidden="true">
          <div className="deck-layer-card-inner">
            <div className="deck-layer-slot" />
            <div className="deck-layer-border-lines" />
          </div>
        </div>
        <div className="deck-card-layer layer-mid" aria-hidden="true">
          <div className="deck-layer-card-inner">
            <div className="deck-layer-slot" />
            <div className="deck-layer-border-lines" />
          </div>
        </div>

        <div className="deck-card-cover">
          <img
            className="deck-cover-image"
            src={coverImage}
            alt={`${title} committee deck`}
            loading="lazy"
            draggable={false}
          />
        </div>
      </div>
    </div>
  );
}
