import { useEffect, useState } from "react";
import type { EventCategoryId } from "../data/eventDetails";
import { categoryOf, prefersReducedMotion } from "../utils";
import { cssVars } from "@/lib/css-vars";
import { ArrowIcon, CategoryIcon, CheckIcon } from "./eventIcons";

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

/** Opens the registration form for this event; after registering it reopens the receipt. */
export function RegisterButton({
  registered,
  onRegister,
  eventName,
  size = "md",
}: {
  registered: boolean;
  onRegister: () => void;
  eventName: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      type="button"
      className={`ep-register ${registered ? "is-added" : ""} is-${size}`}
      aria-label={
        registered ? `View your ${eventName} registration receipt` : `Register for ${eventName}`
      }
      onClick={(e) => {
        e.stopPropagation();
        onRegister();
      }}
    >
      {registered ? (
        <CheckIcon className="ep-register-icon" />
      ) : (
        <ArrowIcon className="ep-register-icon" />
      )}
      <span>{registered ? "Registered" : "Register"}</span>
    </button>
  );
}
