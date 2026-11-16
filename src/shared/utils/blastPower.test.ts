import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { blastPushAt, blastReach, craterReach, maxBlastPush } from "@/shared/utils/blastPower";

const T = DEFAULT_GAME_TUNABLES;
const ROCKET = T.combat.rocket.power;

describe("blastPower", () => {
  it("should reproduce the pre-power rocket blast when power is the rocket's 50", () => {
    expect(ROCKET).toBe(50);
    expect(blastPushAt(T, ROCKET, 0)).toBeCloseTo(1080);
    expect(blastReach(T, ROCKET)).toBeCloseTo(64);
    expect(craterReach(T, ROCKET)).toBeCloseTo(34);
  });

  it("should give no push, reach or crater when power is 0", () => {
    expect(blastPushAt(T, 0, 0)).toBe(0);
    expect(blastReach(T, 0)).toBe(0);
    expect(craterReach(T, 0)).toBe(0);
  });

  it("should scale push, reach and crater in a straight line when power changes", () => {
    expect(blastPushAt(T, 10, 0)).toBeCloseTo(216);
    expect(blastReach(T, 10)).toBeCloseTo(12.8);
    expect(blastPushAt(T, 90, 0)).toBeCloseTo(1944);
    expect(blastReach(T, 90)).toBeCloseTo(115.2);
    expect(craterReach(T, 90)).toBeCloseTo(61.2);
  });

  it("should fall off to the minimum share at the edge and push nothing past the reach", () => {
    expect(blastPushAt(T, ROCKET, 32)).toBeCloseTo(540);
    expect(blastPushAt(T, ROCKET, 63)).toBeCloseTo(1080 * T.combat.blast.minFalloff);
    expect(blastPushAt(T, ROCKET, 65)).toBe(0);
  });

  it("should report the strongest weapon's centre push when the kill zone asks for it", () => {
    expect(maxBlastPush(T)).toBeCloseTo(1080);
  });
});
