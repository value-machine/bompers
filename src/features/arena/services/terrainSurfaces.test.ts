import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { clearCrater } from "@/features/arena/services/terrainGrid";
import { breakableMask, type MaskShapes } from "@/features/arena/services/terrainSurfaces";

const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "m", title: "M" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [
    { shape: { type: "rect", x: 50, y: 101, w: 300, h: 60 }, materialId: "earth" },
    { shape: { type: "rect", x: 0, y: 170, w: 400, h: 30 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

/** Point-in-polygon (even-odd) for a flat [x, y, …] path. */
function inPiece(piece: readonly number[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = piece.length - 2; i < piece.length; j = i, i += 2) {
    const xi = piece[i]!;
    const yi = piece[i + 1]!;
    const xj = piece[j]!;
    const yj = piece[j + 1]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

const covers = (mask: MaskShapes, x: number, y: number): boolean =>
  mask.rects.some((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) ||
  mask.pieces.some((piece) => inPiece(piece, x, y));

describe("breakableMask", () => {
  it("should cover the whole authored slab with plain rects when no blast has touched it", () => {
    const grid = buildTerrainFromLevel(level);
    const mask = breakableMask(grid, grid.distance.slice(), 0);
    expect(mask.pieces).toEqual([]);
    // Authored corners (50, 101) and (350, 161) sit off the 4-unit grid: still covered.
    for (const [x, y] of [
      [50.2, 101.2],
      [349.8, 160.8],
      [200, 130],
    ] as const) {
      expect(covers(mask, x, y)).toBe(true);
    }
  });

  it("should clip along the curved crater rim to within half a unit when a blast cuts the slab", () => {
    const grid = buildTerrainFromLevel(level);
    const initial = grid.distance.slice();
    const centre = { x: 200, y: 101 };
    clearCrater(grid, { ...centre, reach: 34, shape: "round" });
    const mask = breakableMask(grid, initial, 0);
    expect(mask.pieces.length).toBeGreaterThan(0);
    // Walk rays down into the slab: covered exactly where the point lies outside the rim.
    for (let deg = 20; deg <= 160; deg += 7) {
      const a = (deg * Math.PI) / 180;
      for (const r of [34 - 0.5, 34 + 0.5]) {
        const x = centre.x + Math.cos(a) * r;
        const y = centre.y + Math.sin(a) * r;
        expect(covers(mask, x, y), `${deg}° r ${r}`).toBe(r > 34);
      }
    }
  });

  it("should grow the mask by the ink width when asked for the ink mask", () => {
    const grid = buildTerrainFromLevel(level);
    const initial = grid.distance.slice();
    clearCrater(grid, { x: 200, y: 101, reach: 34, shape: "round" });
    const ink = breakableMask(grid, initial, 3);
    expect(covers(ink, 200, 101 + 34 - 2)).toBe(true);
    expect(covers(ink, 200, 101 + 34 - 4)).toBe(false);
  });
});
