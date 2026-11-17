import { describe, expect, it } from "vitest";
import {
  JUICE_SHAKE_CAP_PX,
  JUICE_TIERS,
  isInJuiceWindow,
  JUICE_VOLUME,
  intensityGain,
  isJuiceSquash,
} from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";

const { feel, player } = DEFAULT_GAME_TUNABLES;

describe("game juice scale", () => {
  it("should order the tiers from light to heavy when compared channel by channel", () => {
    const { light, medium, heavy } = JUICE_TIERS;
    for (const key of ["shakePx", "flash", "hitStopSeconds"] as const) {
      expect(light[key]).toBeLessThanOrEqual(medium[key]);
      expect(medium[key]).toBeLessThanOrEqual(heavy[key]);
    }
  });

  it("should reject a squash pose when it loses volume or overstretches", () => {
    expect(isJuiceSquash({ sx: 1.25, sy: 0.75 })).toBe(true);
    expect(isJuiceSquash({ sx: 1.4, sy: 0.6 })).toBe(false);
    expect(isJuiceSquash({ sx: 1.3, sy: 0.77 })).toBe(false);
  });
});

describe("feel tunables conform to the juice scale", () => {
  it("should take shake, flash and hit-stop from the tiers when built", () => {
    expect(feel.shake.hit.px).toBe(JUICE_TIERS.medium.shakePx);
    expect(feel.shake.tumbleBounce.px).toBe(JUICE_TIERS.medium.shakePx);
    expect(feel.shake.explosion.px).toBe(JUICE_TIERS.heavy.shakePx);
    expect(feel.shake.hit.px * feel.shake.hardHitScale).toBe(JUICE_TIERS.heavy.shakePx);
    expect(feel.shake.maxPx).toBe(JUICE_SHAKE_CAP_PX);
    expect(feel.hitFlash.front).toBe(JUICE_TIERS.medium.flash);
    expect(feel.hitFlash.back).toBe(JUICE_TIERS.heavy.flash);
    expect(feel.hitStop.seconds).toBe(JUICE_TIERS.heavy.hitStopSeconds);
  });

  it("should keep every feel duration inside its window when built", () => {
    expect(isInJuiceWindow("flash", feel.hitFlash.holdSeconds)).toBe(true);
    expect(isInJuiceWindow("fade", feel.hitFlash.fadeSeconds)).toBe(true);
    expect(isInJuiceWindow("flash", feel.hitStop.seconds)).toBe(true);
    for (const kick of [feel.shake.hit, feel.shake.explosion, feel.shake.tumbleBounce]) {
      expect(isInJuiceWindow("shake", kick.seconds)).toBe(true);
    }
  });

  it("should keep every squash preset inside the volume band and squash window when built", () => {
    const knockout = feel.knockout.squash;
    for (const preset of [
      player.squash.land,
      player.squash.jump,
      player.squash.wallJump,
      knockout,
    ]) {
      expect(isJuiceSquash(preset)).toBe(true);
      expect(isInJuiceWindow("squash", preset.seconds)).toBe(true);
    }
  });
});

describe("intensityGain", () => {
  it("should rise from the volume floor to full gain when impact speed grows to the full speed", () => {
    expect(intensityGain(0, 900)).toBe(JUICE_VOLUME.minGain);
    expect(intensityGain(450, 900)).toBeCloseTo((JUICE_VOLUME.minGain + 1) / 2);
    expect(intensityGain(900, 900)).toBe(1);
    expect(intensityGain(5000, 900)).toBe(1);
  });
});
