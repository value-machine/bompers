import { describe, expect, it } from "vitest";
import type { LevelMotion } from "@/shared/types/levelMotion.types";
import {
  motionPeakSpeed,
  motionPose,
  pathLength,
  posePoint,
  unposePoint,
} from "@/shared/utils/levelMotion";

// Ground truth: LEVEL_FORMAT § 11 motion definitions (moving-parts D3, D7).
const timing = { periodS: 4, phase: 0 };

describe("motionPose", () => {
  it("should rest at t=0 and reach the offset at half a period when sliding", () => {
    const slide: LevelMotion = { kind: "slide", offset: { x: 0, y: -160 }, ...timing };
    expect(motionPose(slide, 0).dy).toBeCloseTo(0);
    expect(motionPose(slide, 2).dy).toBeCloseTo(-160);
    expect(motionPose(slide, 4).dy).toBeCloseTo(0);
  });

  it("should visit each waypoint at constant speed when following a path", () => {
    const path: LevelMotion = {
      kind: "path",
      offsets: [
        { x: 100, y: 0 },
        { x: 100, y: -100 },
        { x: 0, y: -100 },
      ],
      ...timing,
    };
    expect(pathLength(path.offsets)).toBe(400);
    expect(motionPose(path, 1)).toMatchObject({ dx: 100, dy: 0 });
    expect(motionPose(path, 2.5)).toMatchObject({ dx: 50, dy: -100 });
  });

  it("should shift the cycle by the phase when a phase is set", () => {
    const slide: LevelMotion = { kind: "slide", offset: { x: 80, y: 0 }, periodS: 4, phase: 0.5 };
    expect(motionPose(slide, 0).dx).toBeCloseTo(80);
  });

  it("should turn a quarter clockwise at a quarter period when spinning", () => {
    const spin: LevelMotion = { kind: "spin", direction: 1, ...timing };
    const pose = motionPose(spin, 1);
    const p = posePoint(pose, { x: 0, y: 0 }, { x: 10, y: 0 });
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(10); // y down: clockwise on screen
    const back = unposePoint(pose, { x: 0, y: 0 }, p);
    expect(back.x).toBeCloseTo(10);
    expect(back.y).toBeCloseTo(0);
  });

  it("should peak at the amplitude a quarter period in when swinging", () => {
    const swing: LevelMotion = { kind: "swing", degrees: 30, direction: -1, ...timing };
    expect(motionPose(swing, 1).angle).toBeCloseTo(-Math.PI / 6);
  });
});

describe("motionPeakSpeed", () => {
  it("should be π·|offset|/T for a slide and 2π·reach/T for a spin", () => {
    expect(motionPeakSpeed({ kind: "slide", offset: { x: 0, y: 160 }, ...timing }, 0)).toBeCloseTo(
      40 * Math.PI
    );
    expect(motionPeakSpeed({ kind: "spin", direction: 1, ...timing }, 100)).toBeCloseTo(
      50 * Math.PI
    );
  });
});
