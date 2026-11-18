import { describe, expect, it } from "vitest";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import {
  STAIN_LOOK,
  stainDryness,
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
  const onFloor = (age: number) =>
    stainSamples(grid, floor("3:d2"), { x: 200, y: 100, age, timing });

  it("should colour only solid samples in a thin coat under the surface when goo lands on a floor", () => {
    const samples = onFloor(1);
    const { reach } = stainShape(floor("3:d2"));
    expect(samples.length).toBeGreaterThan(4);
    for (const index of samples) {
      const at = centre(index);
      expect(grid.cells[index]).not.toBe(0);
      expect(at.y - 100).toBeLessThan(STAIN_LOOK.depthSamples * grid.cellSize);
      expect(Math.hypot(at.x - 200, at.y - 100)).toBeLessThan(reach);
    }
  });

  it("should colour nothing when goo lands away from any terrain", () => {
    expect(stainSamples(grid, floor("3:d2"), { x: 200, y: 20, age: 1, timing })).toEqual([]);
  });

  it("should run down the wall over the run time when goo lands on a wall", () => {
    const at = (age: number) => stainSamples(grid, wall("4:d1"), { x: 48, y: 120, age, timing });
    const lowest = (samples: number[]) => Math.max(...samples.map((index) => centre(index).y));
    expect(lowest(at(STAIN_LOOK.runSeconds))).toBeGreaterThan(lowest(at(0.05)) + 8);
    expect(at(1)).toEqual(at(STAIN_LOOK.runSeconds));
  });

  it("should stay whole until the respawn and shrink toward its touch point as it dries", () => {
    const wet = onFloor(2);
    const drying = onFloor(3);
    const nearlyDry = onFloor(3.9);
    expect(onFloor(1)).toEqual(wet);
    expect(drying.length).toBeLessThan(wet.length);
    expect(nearlyDry.length).toBeLessThan(drying.length);
    for (const index of nearlyDry) expect(wet).toContain(index);
  });
});

describe("stain timing", () => {
  it("should be wet until the respawn and fully dry at splatSeconds", () => {
    expect(stainDryness(1.9, timing)).toBe(0);
    expect(stainDryness(3, timing)).toBeCloseTo(0.5);
    expect(stainDryness(4, timing)).toBe(1);
  });

  it("should change stage while running and drying and hold still in between", () => {
    expect(stainStage(0.1, timing)).not.toBe(stainStage(0.3, timing));
    expect(stainStage(0.8, timing)).toBe(stainStage(1.9, timing));
    expect(stainStage(2.5, timing)).not.toBe(stainStage(3, timing));
  });
});
