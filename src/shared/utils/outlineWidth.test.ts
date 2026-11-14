import { describe, expect, it } from "vitest";
import { DESIGN_SCALE, outlineWidth } from "@/shared/utils/outlineWidth";

const screenPx = (kind: Parameters<typeof outlineWidth>[0], zoom: number): number =>
  outlineWidth(kind, zoom).width * zoom;

describe("outlineWidth", () => {
  it("should keep the scaled design width when the clamp does not bite", () => {
    // 3.5 × 0.44 = 1.54 world; at zoom 2 that is 3.08 px, inside [2, 4.5].
    expect(screenPx("character", 2)).toBeCloseTo(3.5 * DESIGN_SCALE * 2, 0);
  });

  it("should stay at least minPx on screen when the camera zooms far out", () => {
    // DESIGN_LANGUAGE § 3 table: characters 2 px, props 1.2 px, effects 1.5 px (±5 % quantisation).
    expect(screenPx("character", 0.3)).toBeGreaterThan(2 * 0.95);
    expect(screenPx("prop", 0.3)).toBeGreaterThan(1.2 * 0.95);
    expect(screenPx("effect", 0.3)).toBeGreaterThan(1.5 * 0.95);
  });

  it("should stay at most maxPx on screen when the camera zooms far in", () => {
    expect(screenPx("terrain", 10)).toBeLessThan(4.5 * 1.05);
    expect(screenPx("prop", 10)).toBeLessThan(3 * 1.05);
  });

  it("should keep the same step when the zoom changes inside the unclamped range", () => {
    // 1.54 world stays between 2 and 4.5 px for zooms ≈ 1.3–2.9: no redraw while zooming there.
    expect(outlineWidth("terrain", 1.4).step).toBe(outlineWidth("terrain", 2.6).step);
  });

  it("should fall back to zoom 1 when the zoom is not positive", () => {
    expect(outlineWidth("prop", 0)).toEqual(outlineWidth("prop", 1));
  });
});
