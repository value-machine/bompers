import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import {
  clearCircle,
  createTerrainGrid,
  getCellInfo,
  groundFrictionBelow,
  isSolidAt,
  rectHitsSolid,
  surfaceBelow,
  takeDirtyChunks,
} from "@/features/arena/services/terrainGrid";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 10, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [
    {
      shape: { type: "rect", x: 0, y: 100, w: 400, h: 20 },

      materialId: "earth",
    },
    { shape: { type: "rect", x: 0, y: 120, w: 400, h: 20 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

describe("terrainGrid", () => {
  it("should read cells outside the grid as empty", () => {
    const grid = buildTerrainFromLevel(level);
    expect(getCellInfo(grid, -1, 11)).toBeNull();
    expect(isSolidAt(grid, 9999, 115)).toBe(false);
  });

  it("should report a rect that overlaps terrain but not one that only touches its top", () => {
    const grid = buildTerrainFromLevel(level);
    expect(rectHitsSolid(grid, { x: 20, y: 80, w: 10, h: 20 })).toBe(false);
    expect(rectHitsSolid(grid, { x: 20, y: 80, w: 10, h: 21 })).toBe(true);
  });

  it("should remove breakable cells but keep unbreakable cells when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    const cleared = clearCircle(grid, { x: 200, y: 115, radius: 25 });
    expect(cleared.removed).toBeGreaterThan(0);
    expect(cleared.byLook).toEqual([
      { materialId: "earth", colorId: "clay", cells: cleared.removed },
    ]);
    expect(getCellInfo(grid, 20, 11)).toBeNull();
    expect(getCellInfo(grid, 20, 12)?.materialId).toBe("stone");
  });

  it("should keep ice cells whatever their colour when a circle is blasted", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        { shape: { type: "rect", x: 0, y: 100, w: 40, h: 10 }, materialId: "ice", colorId: "clay" },
      ],
    });
    expect(clearCircle(grid, { x: 20, y: 105, radius: 30 }).removed).toBe(0);
  });

  it("should report each colour of a material separately when a blast clears both", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        {
          shape: { type: "rect", x: 0, y: 100, w: 20, h: 10 },
          materialId: "earth",
          colorId: "rose",
        },
        {
          shape: { type: "rect", x: 20, y: 100, w: 20, h: 10 },
          materialId: "earth",
          colorId: "mint",
        },
      ],
    });
    const cleared = clearCircle(grid, { x: 20, y: 105, radius: 30 });
    expect(cleared.byLook).toEqual([
      { materialId: "earth", colorId: "rose", cells: 2 },
      { materialId: "earth", colorId: "mint", cells: 2 },
    ]);
  });

  it("should read low friction under the feet when standing on ice", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        { shape: { type: "rect", x: 0, y: 100, w: 200, h: 10 }, materialId: "ice" },
        { shape: { type: "rect", x: 200, y: 100, w: 200, h: 10 }, materialId: "stone" },
      ],
    });
    expect(groundFrictionBelow(grid, { x: 40, y: 100, w: 20 })).toBeCloseTo(0.12);
    expect(groundFrictionBelow(grid, { x: 240, y: 100, w: 20 })).toBe(1);
    expect(groundFrictionBelow(grid, { x: 40, y: 60, w: 20 })).toBe(1);
  });

  it("should mark only the touched chunks dirty when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    takeDirtyChunks(grid);
    clearCircle(grid, { x: 15, y: 105, radius: 6 });
    expect(takeDirtyChunks(grid)).toEqual([0]);
    expect(grid.dirtyChunks.size).toBe(0);
  });

  it("should start with every chunk dirty so the first render draws everything", () => {
    const grid = createTerrainGrid({ cellSize: 8, widthCells: 33, heightCells: 16 });
    expect(takeDirtyChunks(grid)).toEqual([0, 1, 2]);
  });

  it("should find the top of the first surface under a span when it is within range", () => {
    const grid = buildTerrainFromLevel(level);
    expect(surfaceBelow(grid, { x: 20, y: 40, w: 10, range: 240 })).toBe(100);
    expect(surfaceBelow(grid, { x: 20, y: 40, w: 10, range: 30 })).toBeNull();
    expect(surfaceBelow(grid, { x: 900, y: 40, w: 10, range: 240 })).toBeNull();
  });
});
