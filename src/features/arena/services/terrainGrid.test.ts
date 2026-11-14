import { describe, expect, it } from "vitest";
import { TERRAIN_CELL, type LevelData } from "@/features/arena/types/arena.types";
import {
  buildTerrainFromLevel,
  clearCircle,
  createTerrainGrid,
  getCell,
  isSolidAt,
  rectHitsSolid,
  takeDirtyChunks,
} from "@/features/arena/services/terrainGrid";

const level: LevelData = {
  id: "test",
  name: "Test",
  cellSize: 10,
  widthCells: 40,
  heightCells: 20,
  blocks: [
    { x: 0, y: 10, width: 40, height: 2, kind: "destructible" },
    { x: 0, y: 12, width: 40, height: 2, kind: "solid" },
  ],
  spawnPoints: [{ x: 50, y: 100 }],
  dropPoints: [],
  outOfBounds: { x: -100, y: -100, width: 600, height: 400 },
};

describe("terrainGrid", () => {
  it("should fill the cells a level's blocks describe", () => {
    const grid = buildTerrainFromLevel(level);
    expect(getCell(grid, 5, 10)).toBe(TERRAIN_CELL.destructible);
    expect(getCell(grid, 5, 12)).toBe(TERRAIN_CELL.solid);
    expect(getCell(grid, 5, 9)).toBe(TERRAIN_CELL.empty);
  });

  it("should read cells outside the grid as empty", () => {
    const grid = buildTerrainFromLevel(level);
    expect(getCell(grid, -1, 11)).toBe(TERRAIN_CELL.empty);
    expect(isSolidAt(grid, 9999, 115)).toBe(false);
  });

  it("should report a rect that overlaps terrain but not one that only touches its top", () => {
    const grid = buildTerrainFromLevel(level);
    expect(rectHitsSolid(grid, { x: 20, y: 80, width: 10, height: 20 })).toBe(false);
    expect(rectHitsSolid(grid, { x: 20, y: 80, width: 10, height: 21 })).toBe(true);
  });

  it("should remove destructible cells but keep solid cells when a circle is blasted", () => {
    const grid = buildTerrainFromLevel(level);
    const removed = clearCircle(grid, { x: 200, y: 115, radius: 25 });
    expect(removed).toBeGreaterThan(0);
    expect(getCell(grid, 20, 11)).toBe(TERRAIN_CELL.empty);
    expect(getCell(grid, 20, 12)).toBe(TERRAIN_CELL.solid);
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
