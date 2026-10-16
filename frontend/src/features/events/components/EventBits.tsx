import { useEffect, useState } from "react";
import type { EventCategoryId } from "../data/eventDetails";
import { categoryOf, prefersReducedMotion } from "../utils";
import { cssVars } from "@/lib/css-vars";
import { CategoryIcon, CheckIcon, PlusIcon } from "./eventIcons";

/** Cycles through taglines with a soft cross-fade; pauses while hovered. */
export function RotatingTagline({
  lines,
  interval = 3800,
  className = "",
}: {
  lines: string[];
  interval?: number;
  className?: string;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (lines.length < 2 || paused || prefersReducedMotion()) return undefined;
    const t = setInterval(() => setIndex((i) => (i + 1) % lines.length), interval);
    return () => clearInterval(t);
  }, [lines, interval, paused]);

  if (lines.length === 0) return null;
  return (
    <p
      className={`ep-tagline ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <span key={index} className="ep-tagline-text">
        {lines[index % lines.length]}
      </span>
    </p>
  );
}

export function CategoryChip({ id, small = false }: { id: EventCategoryId; small?: boolean }) {
  const cat = categoryOf(id);
  return (
    <span
      className={`ep-cat-chip ${small ? "is-small" : ""}`}
      style={cssVars({ "--hue": cat.hue })}
    >
      <CategoryIcon id={cat.id} className="ep-cat-chip-icon" />
      {cat.label}
    </span>
  );
}

export function RegisterButton({
  added,
  onToggle,
  eventName,
  size = "md",
}: {
  added: boolean;
  onToggle: () => void;
  eventName: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      className={`ep-register ${added ? "is-added" : ""} is-${size}`}
      aria-pressed={added}
      aria-label={added ? `Remove ${eventName} from your pass` : `Add ${eventName} to your pass`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
    >
      {added ? (
        <CheckIcon className="ep-register-icon" />
      ) : (
        <PlusIcon className="ep-register-icon" />
      )}
      <span>{added ? "Added" : "Register"}</span>
    </button>
  );
}
