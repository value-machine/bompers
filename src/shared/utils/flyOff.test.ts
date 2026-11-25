import { describe, expect, it } from "vitest";
import { isInJuiceWindow } from "@/shared/config/gameJuice";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { capCarry, FLY_OFF, flyOffAlpha, flyOffPose, hashNoise } from "@/shared/utils/flyOff";

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

  it("should send the pieces the way the body moved when they inherit its velocity", () => {
    const age = 0.3;
    const meanOffset = (carry?: { vx: number; vy: number }) => {
      const poses = [0, 1, 2, 3].map((index) =>
        flyOffPose({ index, count: 4, age, seed: 2, carry })
      );
      return {
        x: poses.reduce((sum, pose) => sum + pose.x, 0) / poses.length,
        y: poses.reduce((sum, pose) => sum + pose.y, 0) / poses.length,
      };
    };
    const still = meanOffset();
    for (const carry of [
      { vx: -300, vy: 0 },
      { vx: 200, vy: -200 },
      { vx: 0, vy: 250 },
    ]) {
      const moved = meanOffset(carry);
      const dx = moved.x - still.x;
      const dy = moved.y - still.y;
      expect(dx).toBeCloseTo(carry.vx * age);
      expect(dy).toBeCloseTo(carry.vy * age);
      // Same direction as the body's velocity.
      expect(Math.atan2(dy, dx)).toBeCloseTo(Math.atan2(carry.vy, carry.vx));
    }
  });

  it("should keep a still body's fan when there is no velocity to inherit", () => {
    const piece = { index: 1, count: 4, age: 0.2, seed: 3 };
    expect(flyOffPose({ ...piece, carry: { vx: 0, vy: 0 } })).toEqual(flyOffPose(piece));
  });

  it("should cap a huge knockback to the max carry speed and keep its direction", () => {
    const capped = capCarry({ vx: 3000, vy: -4000 });
    expect(Math.hypot(capped.vx, capped.vy)).toBeCloseTo(FLY_OFF.maxCarry);
    expect(Math.atan2(capped.vy, capped.vx)).toBeCloseTo(Math.atan2(-4000, 3000));
    expect(capCarry({ vx: 100, vy: 50 })).toEqual({ vx: 100, vy: 50 });
  });

  it("should keep a capped piece within a screen's reach over most of its flight", () => {
    const seconds = DEFAULT_GAME_TUNABLES.feel.hurt.chunkSeconds;
    const carry = capCarry({ vx: 5000, vy: 0 });
    const pose = flyOffPose({ index: 0, count: 1, age: seconds * 0.7, seed: 1, carry });
    // The camera never shows less than `camera.minViewHeight` (400) units.
    expect(Math.hypot(pose.x, pose.y)).toBeLessThan(DEFAULT_GAME_TUNABLES.camera.minViewHeight / 2);
  });

  it("should fly inside the linger window when timed by the hurt chunk tunable", () => {
    expect(isInJuiceWindow("linger", DEFAULT_GAME_TUNABLES.feel.hurt.chunkSeconds)).toBe(true);
  });
});
