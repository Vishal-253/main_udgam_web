import type { CSSProperties } from "react";

/** Inline style with CSS custom properties, e.g. cssVars({ "--hue": 320 }). */
export const cssVars = (
  vars: Record<`--${string}`, string | number>,
  style?: CSSProperties,
): CSSProperties => ({ ...style, ...vars }) as CSSProperties;
