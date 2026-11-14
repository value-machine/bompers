import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hasCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import {
  SFX_BASE_URL,
  SOUND_FILES,
  pickTakeIndex,
  playbackRateFor,
} from "@/features/sound/services/soundBank";

const publicPath = (url: string): string => resolve(process.cwd(), "public", url.slice(1));

describe("soundBank", () => {
  it("should only list content-catalog sound IDs when mapping files", () => {
    for (const soundId of Object.keys(SOUND_FILES)) {
      expect(hasCatalogEntry("sound", soundId), soundId).toBe(true);
    }
  });

  it("should point at files that exist in public/audio/sfx when listing takes", () => {
    for (const urls of Object.values(SOUND_FILES)) {
      for (const url of urls) {
        expect(url.startsWith(SFX_BASE_URL)).toBe(true);
        expect(existsSync(publicPath(url)), url).toBe(true);
      }
    }
  });

  it("should pitch players by the design-language offsets when given a slot", () => {
    expect(playbackRateFor(null)).toBe(1);
    expect(playbackRateFor(0)).toBe(1);
    expect(playbackRateFor(1)).toBeCloseTo(2 ** (2 / 12));
    expect(playbackRateFor(2)).toBeCloseTo(2 ** (-2 / 12));
    expect(playbackRateFor(3)).toBeCloseTo(2 ** (4 / 12));
  });

  it("should never repeat the previous take when several takes exist", () => {
    for (let previous = 0; previous < 4; previous += 1) {
      for (const random of [0, 0.3, 0.6, 0.99]) {
        const take = pickTakeIndex(4, previous, () => random);
        expect(take).not.toBe(previous);
        expect(take).toBeGreaterThanOrEqual(0);
        expect(take).toBeLessThan(4);
      }
    }
    expect(pickTakeIndex(1, 0, () => 0.5)).toBe(0);
  });
});
