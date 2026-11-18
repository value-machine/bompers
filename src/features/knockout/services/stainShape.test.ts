import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import {
  STAIN_LOOK,
  stainFade,
  stainSamples,
  stainShape,
  stainStage,
} from "@/features/knockout/services/stainShape";

const level: LevelDefinition = {
  formatVersion: 2,
  meta: { levelId: "m", title: "M" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 400, h: 200 },
  terrain: [{ shape: { type: "rect", x: 48, y: 100, w: 304, h: 80 }, materialId: "stone" }],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 600, h: 400 },
};

const timing = { respawnDelaySeconds: 2, splatSeconds: 4 };
const floor = (key: string) => ({ key, nx: 0, ny: -1, radius: 5 }) as const;
const wall = (key: string) => ({ key, nx: -1, ny: 0, radius: 5 }) as const;

describe("stainShape", () => {
  it("should give the same size every time when the key is the same", () => {
    expect(stainShape(floor("7:d1"))).toEqual(stainShape(floor("7:d1")));
  });

  it("should vary in size within the look's range when the keys differ", () => {
    const reaches = ["7:d0", "7:d1", "7:d2", "8:d0", "8:d1", "9:d4"].map(
      (key) => stainShape(floor(key)).reach
    );
    expect(new Set(reaches.map((reach) => reach.toFixed(3))).size).toBe(reaches.length);
    for (const reach of reaches) {
      expect(reach).toBeGreaterThanOrEqual(STAIN_LOOK.reach * 5 * STAIN_LOOK.size.min);
      expect(reach).toBeLessThanOrEqual(STAIN_LOOK.reach * 5 * STAIN_LOOK.size.max);
    }
  });

  it("should run only on a standing wall when the normal and the surface say so", () => {
    expect(stainShape(wall("5:d0")).run).toBeGreaterThan(0);
    expect(stainShape(floor("5:d0")).run).toBe(0);
    expect(stainShape({ ...wall("5:d0"), rides: { mover: 0 } }).run).toBe(0);
  });
});

describe("stainSamples", () => {
  const grid = buildTerrainFromLevel(level);
  const centre = (index: number) => ({
    x: ((index % grid.widthCells) + 0.5) * grid.cellSize,
    y: (Math.floor(index / grid.widthCells) + 0.5) * grid.cellSize,
  });
  const onFloor = (age: number) => stainSamples(grid, floor("3:d2"), { x: 200, y: 100, age });

  it("should dye a round patch that goes deep under the landing when goo lands on a floor", () => {
    const samples = onFloor(1);
    const { reach } = stainShape(floor("3:d2"));
    const depths = samples.map((index) => centre(index).y - 100);
    expect(Math.max(...depths)).toBeGreaterThan(reach * (1 - STAIN_LOOK.ragged) - grid.cellSize);
    for (const index of samples) {
      const at = centre(index);
      expect(grid.cells[index]).not.toBe(0);
      expect(Math.hypot(at.x - 200, at.y - 100)).toBeLessThan(reach);
    }
  });

  it("should give two stains of the same size different inner edges when their keys differ", () => {
    const patch = (key: string) =>
      stainSamples(grid, { ...floor(key), radius: 5 }, { x: 200, y: 100, age: 1 });
    expect(patch("3:d2")).toEqual(patch("3:d2"));
    expect(patch("3:d2")).not.toEqual(patch("6:d4"));
  });

  it("should colour nothing when goo lands away from any terrain", () => {
    expect(stainSamples(grid, floor("3:d2"), { x: 200, y: 20, age: 1 })).toEqual([]);
  });

  it("should run down the wall over the run time when goo lands on a wall", () => {
    const at = (age: number) => stainSamples(grid, wall("4:d1"), { x: 48, y: 120, age });
    const lowest = (samples: number[]) => Math.max(...samples.map((index) => centre(index).y));
    expect(lowest(at(STAIN_LOOK.runSeconds))).toBeGreaterThan(lowest(at(0.05)) + 8);
    expect(at(1)).toEqual(at(STAIN_LOOK.runSeconds));
  });

  it("should keep its shape for its whole life when it has stopped running", () => {
    expect(onFloor(0)).toEqual(onFloor(1));
    expect(onFloor(3.9)).toEqual(onFloor(1));
  });
});

describe("stain timing", () => {
  it("should be full until the respawn and fully faded at splatSeconds", () => {
    expect(stainFade(1.9, timing)).toBe(0);
    expect(stainFade(3, timing)).toBeCloseTo(0.5);
    expect(stainFade(4, timing)).toBe(1);
  });

  it("should change stage only while a wall stain runs", () => {
    expect(stainStage(wall("4:d1"), 0.1)).not.toBe(stainStage(wall("4:d1"), 0.3));
    expect(stainStage(wall("4:d1"), 0.8)).toBe(stainStage(wall("4:d1"), 3.5));
    expect(stainStage(floor("3:d2"), 0.1)).toBe(stainStage(floor("3:d2"), 3.5));
  });
});
