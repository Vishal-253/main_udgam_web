import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The gallery route pulls in three.js, so read its edition list as text instead of importing it.
const source = readFileSync(resolve(__dirname, "../routes/gallery.tsx"), "utf8");
const series = [...source.matchAll(/photoSeries\("(udgam2k\d\d)", (\d+)\)/g)].map((m) => ({
  edition: m[1]!,
  count: Number(m[2]),
}));

describe("gallery photos", () => {
  it("has photos for the editions with a festival archive", () => {
    expect(series.map((s) => s.edition)).toEqual([
      "udgam2k25",
      "udgam2k24",
      "udgam2k23",
      "udgam2k19",
      "udgam2k18",
    ]);
  });

  it("ships every listed photo, small enough for the carousel", () => {
    for (const { edition, count } of series) {
      expect(count, edition).toBeGreaterThan(0);
      expect(count, edition).toBeLessThanOrEqual(10); // the carousel counter and dots stop at 10
      for (let i = 1; i <= count; i++) {
        const file = resolve(__dirname, "../../public/images", edition, `${i}.webp`);
        expect(existsSync(file), file).toBe(true);
        expect(statSync(file).size, file).toBeLessThan(400 * 1024);
      }
    }
  });

  it("links each edition to its own festival site", () => {
    for (const y of ["25", "24", "19", "18", "20"]) {
      expect(source).toContain(`url: "https://udgam.nitsikkim.ac.in/udgam${y}/"`);
    }
  });
});
