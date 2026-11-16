import { describe, expect, it } from "vitest";

import { isOutOfBounds } from "@/shared/utils/outOfBounds";

const bounds = { x: 0, y: 0, w: 1000, h: 600 };

describe("isOutOfBounds", () => {
  it("should be false when the point is far beyond the left, right or top edge", () => {
    expect(isOutOfBounds(bounds, { x: -5000, y: 300 })).toBe(false);
    expect(isOutOfBounds(bounds, { x: 6000, y: 300 })).toBe(false);
    expect(isOutOfBounds(bounds, { x: 500, y: -5000 })).toBe(false);
  });

  it("should be true when the point is below the bottom edge", () => {
    expect(isOutOfBounds(bounds, { x: 500, y: 601 })).toBe(true);
    expect(isOutOfBounds(bounds, { x: -5000, y: 601 })).toBe(true);
  });

  it("should be false when the point is exactly on the bottom edge", () => {
    expect(isOutOfBounds(bounds, { x: 500, y: 600 })).toBe(false);
  });
});
