import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  buildTerrainFromLevel,
  clearCrater,
  getCellInfo,
  isSolidAt,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { canBurn, createFireState, ignite, stepFire } from "@/features/fire/api/fireApi";
import { canFreeze } from "@/features/ice/api/iceApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { placeObject } from "@/features/level-objects/services/objectPlacement";
import type { ObjectPart } from "@/features/level-objects/types/levelObject.types";

/**
 * Placed objects are terrain (level-objects D2, D5): the existing fire, cold and crater code
 * handles a tree with no object-specific code. Ground truth: the material × element table in the
 * content catalog (cardboard burns, earth scorches, ice douses).
 */

const CELL = 4;
const BOX = { x: 100, y: 40, w: 200, h: 240 };

function placedParts(variant: string): ObjectPart[] {
  const placed = placeObject({ kind: "tree", variant, box: BOX, seed: 3 });
  if (!placed.ok) throw new Error("expected a tree");
  return placed.parts;
}

function treeGrid(parts: readonly ObjectPart[]): TerrainGrid {
  const terrain: TerrainPiece[] = parts.map(({ shape, materialId, colorId }) => ({
    shape,
    materialId,
    colorId,
  }));
  const level: LevelDefinition = {
    formatVersion: 2,
    meta: { levelId: "t", title: "T" },
    settings: { cellSize: CELL, gravity: 1 },
    worldSize: { w: 400, h: 320 },
    terrain,
    spawns: [],
    drops: [],
    collectibles: [],
    bounds: { x: 0, y: 0, w: 400, h: 320 },
  };
  return buildTerrainFromLevel(level);
}

/** Sample indices whose cell holds `materialId`. */
function samplesOf(grid: TerrainGrid, materialId: string): number[] {
  const found: number[] = [];
  for (let cy = 0; cy < grid.heightCells; cy++) {
    for (let cx = 0; cx < grid.widthCells; cx++) {
      if (getCellInfo(grid, cx, cy)?.materialId === materialId)
        found.push(cy * grid.widthCells + cx);
    }
  }
  return found;
}

/** Runs fire to `seconds` after lighting one sample. */
function burnFrom(grid: TerrainGrid, start: number, seconds: number) {
  const fire = createFireState(grid);
  ignite(fire, grid, { body: 0, index: start, time: 0 });
  for (let t = 0; t < seconds; t += 1 / 60) {
    stepFire(fire, grid, { now: t, tunables: DEFAULT_GAME_TUNABLES });
  }
  return fire.grounds[0]!;
}

describe("objects as terrain", () => {
  it("should spread fire through an oak's leaves and never into its bark when the canopy is lit", () => {
    const grid = treeGrid(placedParts("oak"));
    const leaves = samplesOf(grid, "cardboard");
    const bark = samplesOf(grid, "earth");
    expect(leaves.length).toBeGreaterThan(100);
    expect(bark.length).toBeGreaterThan(20);
    const start = leaves.find((i) => canBurn(grid, i))!;
    const ground = burnFrom(grid, start, 12);
    const lit = leaves.filter((i) => Number.isFinite(ground.igniteAt[i] ?? Infinity));
    expect(lit.length / leaves.length).toBeGreaterThan(0.9);
    expect(bark.every((i) => !Number.isFinite(ground.igniteAt[i] ?? Infinity))).toBe(true);
  });

  it("should keep a snowy pine's needles that touch a cap from catching when read by the fire", () => {
    const grid = treeGrid(placedParts("snowy-pine"));
    const ice = samplesOf(grid, "ice");
    expect(ice.length).toBeGreaterThan(0);
    const w = grid.widthCells;
    const touching = samplesOf(grid, "cardboard").filter((i) =>
      [-1, 1, -w, w].some((d) => ice.includes(i + d))
    );
    expect(touching.length).toBeGreaterThan(0);
    expect(touching.every((i) => !canBurn(grid, i))).toBe(true);
  });

  it("should let the cold freeze a tree's trunk and leaves when the material table allows it", () => {
    const grid = treeGrid(placedParts("pine"));
    for (const material of ["earth", "cardboard"]) {
      expect(
        samplesOf(grid, material).some((i) => canFreeze(grid, i)),
        material
      ).toBe(true);
    }
  });

  it("should open a crater in a tree's trunk when a blast hits it", () => {
    const grid = treeGrid(placedParts("dead"));
    const trunk = { x: BOX.x + BOX.w / 2, y: BOX.y + BOX.h - 20 };
    expect(isSolidAt(grid, trunk.x, trunk.y)).toBe(true);
    const cleared = clearCrater(grid, { ...trunk, reach: 24, shape: "round" });
    expect(cleared.removed).toBeGreaterThan(0);
    expect(isSolidAt(grid, trunk.x, trunk.y)).toBe(false);
  });
});
