import { describe, expect, it } from "vitest";
import { shapeContains } from "@/shared/utils/shapeGeometry";

const square = {
  type: "polygon" as const,
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ],
};

describe("shapeContains", () => {
  it("should treat a rect as half-open when the point is on its right edge", () => {
    const rect = { type: "rect" as const, x: 0, y: 0, w: 10, h: 10 };
    expect(shapeContains(rect, { x: 0, y: 0 })).toBe(true);
    expect(shapeContains(rect, { x: 10, y: 5 })).toBe(false);
  });

  it("should include points on the rim when the shape is a circle", () => {
    const circle = { type: "circle" as const, cx: 0, cy: 0, r: 5 };
    expect(shapeContains(circle, { x: 5, y: 0 })).toBe(true);
    expect(shapeContains(circle, { x: 4, y: 4 })).toBe(false);
  });

  it("should find points inside a polygon in either winding direction", () => {
    expect(shapeContains(square, { x: 5, y: 5 })).toBe(true);
    const reversed = { ...square, points: [...square.points].reverse() };
    expect(shapeContains(reversed, { x: 5, y: 5 })).toBe(true);
    expect(shapeContains(square, { x: 15, y: 5 })).toBe(false);
  });

  it("should fill the overlap of a self-overlapping polygon when the non-zero rule applies", () => {
    // Two laps around the same square: winding 2 inside (even-odd would call it empty).
    const twice = { type: "polygon" as const, points: [...square.points, ...square.points] };
    expect(shapeContains(twice, { x: 5, y: 5 })).toBe(true);
  });
});
