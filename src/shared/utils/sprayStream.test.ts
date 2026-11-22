import { describe, expect, it } from "vitest";
import { sprayStream, type SprayStreamLook } from "@/shared/utils/sprayStream";

const LOOK: SprayStreamLook = {
  perRay: 5,
  speed: 100,
  startAt: 8,
  radius: 2,
  grow: 4,
  wobble: 0,
  rise: 0,
};
const origin = { x: 0, y: 0 };

describe("spray stream (freeze-ray-spray D1)", () => {
  it("should keep each puff on its own ray between the start and that ray's end", () => {
    const ends = [
      { x: 40, y: 30 },
      { x: 150, y: 0 },
    ];
    for (const timeSeconds of [0, 0.3, 1.7]) {
      const puffs = sprayStream({ origin, ends }, { timeSeconds, look: LOOK });
      puffs.forEach((puff, i) => {
        const end = ends[Math.floor(i / LOOK.perRay)]!;
        const length = Math.hypot(end.x, end.y);
        const d = Math.hypot(puff.x, puff.y);
        expect(d).toBeGreaterThanOrEqual(LOOK.startAt - 1e-9);
        expect(d).toBeLessThanOrEqual(length + 1e-9);
        // On the ray: the cross product with its direction is zero.
        expect(Math.abs(puff.x * end.y - puff.y * end.x) / length).toBeLessThan(1e-6);
      });
    }
  });

  it("should carry no puffs on a ray that ends before the start", () => {
    const puffs = sprayStream({ origin, ends: [{ x: 5, y: 0 }] }, { timeSeconds: 0, look: LOOK });
    expect(puffs).toEqual([]);
  });

  it("should grow a puff from its start radius toward start plus grow at the ray's end", () => {
    const puffs = sprayStream(
      { origin, ends: [{ x: 100, y: 0 }] },
      { timeSeconds: 0.2, look: LOOK }
    );
    for (const puff of puffs) expect(puff.r).toBeCloseTo(LOOK.radius + LOOK.grow * puff.along, 9);
  });
});
