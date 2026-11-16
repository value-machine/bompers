import { describe, expect, it } from "vitest";
import { EMPTY_CELL } from "@/features/arena/types/arena.types";
import {
  clearCrater,
  createTerrainGrid,
  writeSample,
  slotFor,
} from "@/features/arena/services/terrainGrid";
import { readTile, tileCellsFor } from "@/features/arena/services/terrainTiles";

function dirtGrid() {
  const grid = createTerrainGrid({ cellSize: 8, widthCells: 12, heightCells: 6 });
  const dirt = slotFor(grid, {
    materialId: "earth",
    colorId: "clay",
    toughness: 1,
    friction: 1,
    surface: "breakable",
  });
  const stone = slotFor(grid, {
    materialId: "stone",
    colorId: "plum",
    toughness: null,
    friction: 1,
    surface: "plain",
  });
  for (let cy = 2; cy < 4; cy += 1) {
    for (let cx = 0; cx < 12; cx += 1) writeSample(grid, { cx, cy, slot: dirt });
  }
  for (let cx = 0; cx < 12; cx += 1) writeSample(grid, { cx, cy: 4, slot: stone });
  return { grid, dirt, initial: grid.cells.slice() };
}

describe("terrainTiles", () => {
  it("should group 2 × 2 sim cells into one tile when cells are 8 units", () => {
    expect(tileCellsFor(8)).toBe(2);
    expect(tileCellsFor(28)).toBe(1);
  });

  it("should read a fully filled breakable tile as intact and uncracked at load", () => {
    const { grid, dirt, initial } = dirtGrid();
    expect(readTile(grid, initial, { tx: 2, ty: 1, k: 2 })).toMatchObject({
      slot: dirt,
      intact: true,
      cracked: false,
    });
  });

  it("should ignore unbreakable cells when reading tiles", () => {
    const { grid, initial } = dirtGrid();
    expect(readTile(grid, initial, { tx: 1, ty: 2, k: 2 }).slot).toBe(EMPTY_CELL);
  });

  it("should crack the tiles next to a blasted cell but not the ones further away", () => {
    const { grid, initial } = dirtGrid();
    clearCrater(grid, { x: 8, y: 20, reach: 5, shape: "round" });
    const blasted = readTile(grid, initial, { tx: 0, ty: 1, k: 2 });
    expect(blasted).toMatchObject({ intact: false, cracked: true });
    expect(readTile(grid, initial, { tx: 1, ty: 1, k: 2 }).cracked).toBe(true);
    expect(readTile(grid, initial, { tx: 3, ty: 1, k: 2 }).cracked).toBe(false);
  });
});
