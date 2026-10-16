import React, { useMemo } from "react";

/**
 * PetalsOverlay Component
 * Renders subtle, elegant floating cherry blossom petals drifting across the viewport.
 * Uses hardware-accelerated CSS animations, low opacity, and subtle blur for depth of field.
 */
export default function PetalsOverlay() {
  // Generate a fixed set of petal configs so re-renders don't cause jumps
  const petals = useMemo(() => {
    return [
      { id: 1, left: "4%", size: 14, delay: "0s", duration: "11s", swayDuration: "4.2s", opacity: 0.55, blur: "0px" },
      { id: 2, left: "14%", size: 18, delay: "2.8s", duration: "13.5s", swayDuration: "5s", opacity: 0.65, blur: "0.5px" },
      { id: 3, left: "26%", size: 12, delay: "6.2s", duration: "10.5s", swayDuration: "3.8s", opacity: 0.45, blur: "1px" },
      { id: 4, left: "42%", size: 16, delay: "1.4s", duration: "14s", swayDuration: "4.6s", opacity: 0.5, blur: "0px" },
      { id: 5, left: "60%", size: 13, delay: "4.5s", duration: "12s", swayDuration: "4s", opacity: 0.48, blur: "0.8px" },
      { id: 6, left: "74%", size: 20, delay: "7.1s", duration: "15s", swayDuration: "5.5s", opacity: 0.6, blur: "0px" },
      { id: 7, left: "86%", size: 15, delay: "3.3s", duration: "11.8s", swayDuration: "4.4s", opacity: 0.52, blur: "0.5px" },
      { id: 8, left: "95%", size: 17, delay: "8.5s", duration: "13.2s", swayDuration: "4.8s", opacity: 0.58, blur: "0px" },
    ];
  }, []);

  return (
    <div className="petals-container" aria-hidden="true">
      {petals.map((petal) => (
        <div
          key={petal.id}
          className="petal-item"
          style={{
            left: petal.left,
            width: `${petal.size}px`,
            height: `${petal.size * 1.3}px`,
            animationDelay: petal.delay,
            animationDuration: petal.duration,
            opacity: petal.opacity,
            filter: petal.blur !== "0px" ? `blur(${petal.blur})` : "none",
          }}
        >
          <div
            className="petal-sway"
            style={{
              animationDuration: petal.swayDuration,
            }}
          >
            {/* Realistic 5-point curved sakura petal SVG */}
            <svg
              viewBox="0 0 30 40"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="petal-svg"
            >
              <defs>
                <linearGradient id={`petalGrad-${petal.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFFBF2" />
                  <stop offset="45%" stopColor="#F6C9A8" />
                  <stop offset="100%" stopColor="#F3B39C" />
                </linearGradient>
              </defs>
              <path
                d="M15 0 C22 3 29 12 28 22 C27 30 20 37 15 40 C10 37 3 30 2 22 C1 12 8 3 15 0 Z"
                fill={`url(#petalGrad-${petal.id})`}
              />
              {/* Subtle petal notch / center fold */}
              <path
                d="M15 2 Q14.5 18 15 36"
                stroke="rgba(246, 201, 168, 0.5)"
                strokeWidth="0.8"
                strokeLinecap="round"
              />
            </svg>
          </div>
        </div>
      ))}
    </div>
  );
}
