import { describe, expect, it } from "vitest";
import {
  blendPose,
  easeOutBack,
  easeOutQuad,
  popInScale,
  springBackPose,
} from "@/shared/utils/easing";

describe("easing", () => {
  it("should run from 0 to 1 and overshoot on the way when eased back-out", () => {
    expect(easeOutBack(0)).toBeCloseTo(0, 6);
    expect(easeOutBack(1)).toBe(1);
    expect(easeOutBack(0.7)).toBeGreaterThan(1);
    expect(easeOutQuad(0.5)).toBe(0.75);
  });

  it("should strike the pose at the start and be at rest at the end when springing back", () => {
    const pose = { sx: 1.2, sy: 0.84 };
    expect(springBackPose(pose, 0).sx).toBeCloseTo(1.2, 6);
    expect(springBackPose(pose, 1)).toEqual({ sx: 1, sy: 1 });
    expect(springBackPose(pose, -0.1)).toEqual({ sx: 1, sy: 1 });
    expect(blendPose(pose, 0.5).sx).toBeCloseTo(1.1, 6);
    expect(blendPose(pose, 0.5).sy).toBeCloseTo(0.92, 6);
  });

  it("should grow from nothing to full size when popping in", () => {
    expect(popInScale(0)).toBeCloseTo(0, 6);
    expect(popInScale(1)).toBe(1);
    expect(popInScale(2)).toBe(1);
  });
});
