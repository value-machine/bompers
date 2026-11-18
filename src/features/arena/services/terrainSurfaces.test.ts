import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import { clearCrater } from "@/features/arena/services/terrainGrid";
import {
  breakableRegion,
  edgeAbove,
  markedRegion,
  terrainContour,
  type MaskShapes,
} from "@/features/arena/services/terrainSurfaces";

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
  terrainContour(grid, { grow: 0, region: breakableRegion(grid) });
const outline = (grid: ReturnType<typeof buildTerrainFromLevel>): MaskShapes =>
  terrainContour(grid, { grow: W });

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

describe("terrainContour limited to marked samples (a burning or frozen part)", () => {
  type Grid = ReturnType<typeof buildTerrainFromLevel>;
  const centre = (grid: Grid, index: number) => ({
    x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
    y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
  });
  /** The earth slab's samples that pass `keep` (the stone floor starts at y 170). */
  const earth = (grid: Grid, keep: (at: { x: number; y: number }) => boolean): number[] =>
    [...grid.cells.keys()].filter((index) => {
      const at = centre(grid, index);
      return grid.cells[index] !== 0 && at.y < 165 && keep(at);
    });
  const part = (grid: Grid, samples: number[], grow = 0): MaskShapes => {
    const region = markedRegion(grid, samples);
    return region ? terrainContour(grid, { grow, region }) : { rects: [], pieces: [] };
  };

  it("should follow the terrain's own edge when the marked part reaches it", () => {
    const grid = buildTerrainFromLevel(level);
    const mask = part(
      grid,
      earth(grid, (at) => at.x < 200)
    );
    expect(covers(mask, 120, 101.6)).toBe(true);
    expect(covers(mask, 120, 100.4)).toBe(false);
    // The slab's rounded corner, as the terrain fill has it.
    expect(covers(mask, 50.3, 101.3)).toBe(false);
  });

  it("should follow the curved crater rim to within half a unit when the marked ground is cut", () => {
    const grid = buildTerrainFromLevel(level);
    const hole = { x: 200, y: 101 };
    clearCrater(grid, { ...hole, reach: 34, shape: "round" });
    const mask = part(
      grid,
      earth(grid, () => true)
    );
    for (let deg = 20; deg <= 160; deg += 7) {
      const a = (deg * Math.PI) / 180;
      for (const r of [34 - 0.5, 34 + 0.5]) {
        const x = hole.x + Math.cos(a) * r;
        const y = hole.y + Math.sin(a) * r;
        expect(covers(mask, x, y), `${deg}° r ${r}`).toBe(r > 34);
      }
    }
  });

  it("should hold every marked sample and no unmarked one when the part ends inside the terrain", () => {
    const grid = buildTerrainFromLevel(level);
    const inPart = (at: { x: number; y: number }) => at.x < 200 + 12 * Math.sin(at.y / 8);
    const samples = earth(grid, inPart);
    const mask = part(grid, samples);
    const marked = new Set(samples);
    for (const index of earth(grid, (at) => at.x > 150 && at.x < 250)) {
      const at = centre(grid, index);
      expect(covers(mask, at.x, at.y), `${at.x}, ${at.y}`).toBe(marked.has(index));
    }
  });

  it("should show a single marked sample when a part has just started", () => {
    const grid = buildTerrainFromLevel(level);
    const [index] = earth(grid, (at) => at.x > 200 && at.y > 130);
    const at = centre(grid, index!);
    const mask = part(grid, [index!]);
    expect(covers(mask, at.x, at.y)).toBe(true);
    expect(covers(mask, at.x + grid.cellSize, at.y)).toBe(false);
  });

  it("should stay inside the terrain's outline when the part is grown for its ink line", () => {
    const grid = buildTerrainFromLevel(level);
    const ink = part(
      grid,
      earth(grid, (at) => at.x < 200),
      W
    );
    expect(covers(ink, 120, 101 - W + 0.6)).toBe(true);
    expect(covers(ink, 120, 101 - W - 0.6)).toBe(false);
  });

  it("should be nothing when no solid sample is marked", () => {
    const grid = buildTerrainFromLevel(level);
    expect(markedRegion(grid, [])).toBeNull();
    expect(markedRegion(grid, [0])).toBeNull();
  });
});

describe("edgeAbove", () => {
  it("should give the slab's top where a sample has air above it and null where it has terrain", () => {
    const grid = buildTerrainFromLevel(level);
    const firstRow = [...Array(grid.heightCells).keys()].find(
      (cy) => grid.cells[cy * grid.widthCells + 50] !== 0
    )!;
    const top = firstRow * grid.widthCells + 50;
    expect(edgeAbove(grid, top)).toBeCloseTo(101, 0);
    expect(edgeAbove(grid, top + grid.widthCells)).toBeNull();
    expect(edgeAbove(grid, top - grid.widthCells)).toBeNull();
  });

  it("should move with the terrain when a blast cuts it", () => {
    const grid = buildTerrainFromLevel(level);
    const before = grid.shapeVersion;
    clearCrater(grid, { x: 200, y: 101, reach: 34, shape: "round" });
    expect(grid.shapeVersion).toBeGreaterThan(before);
    const column = 50;
    const first = [...Array(grid.heightCells).keys()].find(
      (cy) => grid.cells[cy * grid.widthCells + column] !== 0
    )!;
    expect(edgeAbove(grid, first * grid.widthCells + column)).toBeCloseTo(101 + 34, 0);
  });
});
