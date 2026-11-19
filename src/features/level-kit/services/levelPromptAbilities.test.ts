import { describe, expect, it } from "vitest";
import { buildLevelPrompt } from "@/features/level-kit/services/levelPrompt";
import {
  brakeSlide,
  freezePatchRadius,
  iceGrip,
  liftJumpApex,
  rollCoast,
  rollSlopeSpeed,
} from "@/features/level-kit/services/levelPromptAbilities";
import { DEFAULT_GAME_TUNABLES as T } from "@/shared/config/gameTunables";
import { MOTION_LIMITS } from "@/shared/utils/levelMotion";

const n = (value: number): string => `\`${value}\``;
const deg = (radians: number): string => `\`${Math.round((radians * 180) / Math.PI)}°\``;

describe("level prompt ability numbers", () => {
  const prompt = buildLevelPrompt();

  it("should state the slope, roll, ice, freeze-ray and mover tunables verbatim when built", () => {
    const { slope } = T.player;
    const { freezeRay } = T.combat;
    const expected = [
      deg(slope.lipAngle),
      deg(slope.restAngle),
      n(slope.lipRise),
      n(T.roll.maxSeconds),
      n(T.roll.jumpCarryMax),
      n(T.roll.sweepTurnsPerSecond),
      n(T.dive.rollCarryMax),
      n(iceGrip()),
      n(freezeRay.length),
      `±${freezeRay.halfAngleDegrees}°`,
      n(T.ice.freezeAreaPerSecond),
      n(T.ice.frozenSeconds),
      n(T.ice.blob.frozenSeconds),
      n(T.ice.blob.slideGrip),
      n(MOTION_LIMITS.rideSpeed),
    ];
    for (const text of expected) expect(prompt).toContain(text);
  });

  it("should match the tunables' own notes when deriving roll and freeze numbers", () => {
    // gameTunables.ts: "a 1000 roll on the flat stops in ≈ 480 units", "on 20° ≈ 190 units / s",
    // "a full 3 s charge … a round patch about 59 units in radius".
    expect(rollCoast(T, 1000)).toBeCloseTo(476, 0);
    expect(rollSlopeSpeed(T, 20)).toBeGreaterThan(180);
    expect(rollSlopeSpeed(T, 20)).toBeLessThan(195);
    expect(Math.round(freezePatchRadius(T))).toBe(59);
    expect(rollCoast(T, 900, iceGrip())).toBeLessThan(900 * T.roll.maxSeconds);
  });

  it("should follow the tunables when they change", () => {
    const changed = buildLevelPrompt({
      ...T,
      roll: { ...T.roll, sweepTurnsPerSecond: 2.5, rollingDecel: 400, crouchRollDelay: 1.3 },
      player: { ...T.player, groundDecel: 6000 },
      combat: { ...T.combat, freezeRay: { ...T.combat.freezeRay, length: 240 } },
    });
    expect(changed).toContain(n(2.5));
    expect(changed).toContain(`${n(1.3)} s without firing`);
    expect(changed).toContain(`${n(240)} units long`);
    const changedT = { ...T, roll: { ...T.roll, rollingDecel: 400 } };
    expect(changed).toContain(`coasts ~${n(Math.round(rollCoast(changedT, T.dive.launchSpeed)))}`);
    const brakeT = { ...T, player: { ...T.player, groundDecel: 6000 } };
    expect(changed).toContain(`slides ~${n(Math.round(brakeSlide(brakeT, iceGrip())))}`);
    expect(prompt).toContain(`peaks ~${n(Math.round(liftJumpApex(T)))}`);
  });
});
