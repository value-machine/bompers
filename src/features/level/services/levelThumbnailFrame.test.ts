import { describe, expect, it } from "vitest";
import { THUMBNAIL_ASPECT, thumbnailFrame } from "@/features/level/services/levelThumbnailFrame";

describe("thumbnailFrame", () => {
  it("should keep the 16:10 aspect and contain the bounds when the bounds are tall", () => {
    const bounds = { x: 0, y: 0, w: 500, h: 1000 };
    const frame = thumbnailFrame(bounds);
    expect(frame.w / frame.h).toBeCloseTo(THUMBNAIL_ASPECT);
    expect(frame.x).toBeLessThanOrEqual(bounds.x);
    expect(frame.y).toBeLessThanOrEqual(bounds.y);
    expect(frame.x + frame.w).toBeGreaterThanOrEqual(bounds.x + bounds.w);
    expect(frame.y + frame.h).toBeGreaterThanOrEqual(bounds.y + bounds.h);
  });

  it("should centre the frame on the bounds when the bounds are wide", () => {
    const bounds = { x: 100, y: 50, w: 3000, h: 400 };
    const frame = thumbnailFrame(bounds);
    expect(frame.w / frame.h).toBeCloseTo(THUMBNAIL_ASPECT);
    expect(frame.x + frame.w / 2).toBeCloseTo(bounds.x + bounds.w / 2);
    expect(frame.y + frame.h / 2).toBeCloseTo(bounds.y + bounds.h / 2);
  });
});
