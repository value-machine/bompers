import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/services/terrainRaster";
import {
  clearCircle,
  createTerrainGrid,
  getCellInfo,
  isSolidAt,
  rectHitsSolid,
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
      role: "destructible",
      materialId: "dirt",
    },
    { shape: { type: "rect", x: 0, y: 120, w: 400, h: 20 }, role: "platform", materialId: "stone" },
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

  it("should remove destructible cells but keep platform cells when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    const removed = clearCircle(grid, { x: 200, y: 115, radius: 25 });
    expect(removed).toBeGreaterThan(0);
    expect(getCellInfo(grid, 20, 11)).toBeNull();
    expect(getCellInfo(grid, 20, 12)?.materialId).toBe("stone");
  });

  it("should keep a destructible-role cell whose material is indestructible", () => {
    const grid = buildTerrainFromLevel({
      ...level,
      terrain: [
        {
          shape: { type: "rect", x: 0, y: 100, w: 40, h: 10 },
          role: "destructible",
          materialId: "stone",
        },
      ],
    });
    expect(clearCircle(grid, { x: 20, y: 105, radius: 30 })).toBe(0);
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
});
