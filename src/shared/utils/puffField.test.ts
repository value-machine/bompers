import { describe, expect, it } from "vitest";
import { puffFieldRings } from "@/shared/utils/puffField";

const look = { cell: 2, reach: 2 };
const extentX = (rings: { points: number[] }[]): [number, number] => {
  const xs = rings.flatMap((ring) => ring.points.filter((_, i) => i % 2 === 0));
  return [Math.min(...xs), Math.max(...xs)];
};

describe("puff field (freeze-ray-shape D1)", () => {
  it("should merge two overlapping puffs into one closed ring", () => {
    const [rings = []] = puffFieldRings(
      [
        { x: 0, y: 0, r: 6 },
        { x: 10, y: 0, r: 6 },
      ],
      { look, levels: [0.45] }
    );
    expect(rings).toHaveLength(1);
    expect(rings[0]!.closed).toBe(true);
  });

  it("should keep two far-apart puffs as two rings", () => {
    const [rings = []] = puffFieldRings(
      [
        { x: 0, y: 0, r: 4 },
        { x: 100, y: 0, r: 4 },
      ],
      { look, levels: [0.45] }
    );
    expect(rings).toHaveLength(2);
  });

  it("should sit inside a higher level when the level rises", () => {
    const puffs = [{ x: 0, y: 0, r: 8 }];
    const [low = [], high = []] = puffFieldRings(puffs, { look, levels: [0.3, 0.8] });
    const [lowMin, lowMax] = extentX(low);
    const [highMin, highMax] = extentX(high);
    expect(highMin).toBeGreaterThan(lowMin);
    expect(highMax).toBeLessThan(lowMax);
  });

  it("should give no rings when there are no puffs", () => {
    expect(puffFieldRings([], { look, levels: [0.45, 1] })).toEqual([[], []]);
  });
});
