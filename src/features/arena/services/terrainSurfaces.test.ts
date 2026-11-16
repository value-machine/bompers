import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { clearCrater } from "@/features/arena/services/terrainGrid";
import { terrainContour, type MaskShapes } from "@/features/arena/services/terrainSurfaces";

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

const W = 3;
const fill = (grid: ReturnType<typeof buildTerrainFromLevel>): MaskShapes =>
  terrainContour(grid, { grow: 0, breakableOnly: true });
const outline = (grid: ReturnType<typeof buildTerrainFromLevel>): MaskShapes =>
  terrainContour(grid, { grow: W, breakableOnly: false });

describe("terrainContour", () => {
  it("should trace an untouched slab as itself: fill inside its edge, ink one width outside it", () => {
    const grid = buildTerrainFromLevel(level);
    expect(covers(fill(grid), 200, 101.6)).toBe(true);
    expect(covers(fill(grid), 200, 100.4)).toBe(false);
    expect(covers(outline(grid), 200, 101 - W + 0.6)).toBe(true);
    expect(covers(outline(grid), 200, 101 - W - 0.6)).toBe(false);
    // Rounded corner (radius ≈ 6.2), like the drawn slab: the very corner point is outside.
    expect(covers(fill(grid), 50.3, 101.3)).toBe(false);
  });

  it("should clip along the curved crater rim to within half a unit when a blast cuts the slab", () => {
    const grid = buildTerrainFromLevel(level);
    const centre = { x: 200, y: 101 };
    clearCrater(grid, { ...centre, reach: 34, shape: "round" });
    const mask = fill(grid);
    for (let deg = 20; deg <= 160; deg += 7) {
      const a = (deg * Math.PI) / 180;
      for (const r of [34 - 0.5, 34 + 0.5]) {
        const x = centre.x + Math.cos(a) * r;
        const y = centre.y + Math.sin(a) * r;
        expect(covers(mask, x, y), `${deg}° r ${r}`).toBe(r > 34);
      }
    }
  });

  it("should outline every rim and both cut faces when overlapping craters split the slab", () => {
    const grid = buildTerrainFromLevel(level);
    clearCrater(grid, { x: 150, y: 101, reach: 34, shape: "round" });
    clearCrater(grid, { x: 180, y: 140, reach: 34, shape: "round" });
    const ink = outline(grid);
    expect(covers(ink, 150 + Math.cos(2.4) * 32, 101 + Math.sin(2.4) * 32)).toBe(true);
    expect(covers(ink, 180 - 32, 140)).toBe(true);
    expect(covers(ink, 180 + 32, 140)).toBe(true);
    expect(covers(ink, 180, 140)).toBe(false);
  });

  it("should leave no ink where a platform used to be when blasts remove it completely", () => {
    const grid = buildTerrainFromLevel(level);
    for (let x = 60; x <= 340; x += 40) {
      clearCrater(grid, { x, y: 131, reach: 60, shape: "round" });
    }
    const ink = outline(grid);
    expect(fill(grid).rects.length + fill(grid).pieces.length).toBe(0);
    // Along the old top, ends and bottom of the platform: no outline left behind.
    for (const [x, y] of [
      [200, 99],
      [48, 130],
      [352, 130],
      [200, 162],
    ] as const) {
      expect(covers(ink, x, y), `${x}, ${y}`).toBe(false);
    }
    // The stone floor below keeps its outline.
    expect(covers(ink, 200, 168)).toBe(true);
  });
});
