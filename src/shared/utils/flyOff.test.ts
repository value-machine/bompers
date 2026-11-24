import { describe, expect, it } from "vitest";
import { isInJuiceWindow } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { flyOffAlpha, flyOffPose, hashNoise } from "@/shared/utils/flyOff";

describe("flyOff", () => {
  it("should start every piece at its place with no spin when no time has passed", () => {
    expect(flyOffPose({ index: 2, count: 4, age: 0, seed: 3 })).toEqual({
      x: 0,
      y: 0,
      rotation: 0,
    });
  });

  it("should fan the pieces out left to right and send them up first when they leave", () => {
    const poses = [0, 1, 2, 3].map((index) => flyOffPose({ index, count: 4, age: 0.05, seed: 1 }));
    expect(poses[0]!.x).toBeLessThan(poses[3]!.x);
    expect(poses.every((pose) => pose.y < 0)).toBe(true);
  });

  it("should bring the pieces down again when gravity has had time", () => {
    expect(flyOffPose({ index: 0, count: 1, age: 0.45, seed: 1 }).y).toBeGreaterThan(0);
  });

  it("should stay opaque for two thirds of the flight and be gone at its end", () => {
    expect(flyOffAlpha(0.2, 0.45)).toBe(1);
    expect(flyOffAlpha(0.45, 0.45)).toBe(0);
  });

  it("should give the same noise for the same seed and index", () => {
    expect(hashNoise(5, 2)).toBe(hashNoise(5, 2));
    expect(hashNoise(5, 2)).toBeGreaterThanOrEqual(0);
    expect(hashNoise(5, 2)).toBeLessThan(1);
  });

  it("should fly inside the linger window when timed by the hurt chunk tunable", () => {
    expect(isInJuiceWindow("linger", DEFAULT_GAME_TUNABLES.feel.hurt.chunkSeconds)).toBe(true);
  });
});
