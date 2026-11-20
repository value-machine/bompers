import { describe, expect, it } from "vitest";
import { ambientPose, ambientSeeds } from "@/features/backdrop/services/backdropAmbient";

describe("ambientPose", () => {
  const screen = { width: 800, height: 600, cameraX: 0, nowMs: 0 };
  const seeds = ambientSeeds(20, 7);

  it("should keep every particle on screen when time and camera move", () => {
    for (const kind of ["stars", "snow", "embers", "bubbles"] as const) {
      for (const nowMs of [0, 1234, 98765]) {
        for (const seed of seeds) {
          const pose = ambientPose(kind, seed, { ...screen, nowMs, cameraX: -5000 });
          expect(pose.x).toBeGreaterThanOrEqual(0);
          expect(pose.x).toBeLessThan(800);
          expect(pose.y).toBeGreaterThanOrEqual(0);
          expect(pose.y).toBeLessThanOrEqual(600);
          expect(pose.alpha).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("should move snow down and embers up when time passes", () => {
    const seed = { x: 0.5, y: 0.5, size: 1, phase: 0 };
    const snow0 = ambientPose("snow", seed, screen).y;
    const snow1 = ambientPose("snow", seed, { ...screen, nowMs: 1000 }).y;
    expect(snow1).toBeGreaterThan(snow0);
    const ember0 = ambientPose("embers", seed, screen).y;
    const ember1 = ambientPose("embers", seed, { ...screen, nowMs: 1000 }).y;
    expect(ember1).toBeLessThan(ember0);
  });

  it("should keep stars in the upper sky when placed", () => {
    for (const seed of seeds) expect(ambientPose("stars", seed, screen).y).toBeLessThanOrEqual(360);
  });
});
