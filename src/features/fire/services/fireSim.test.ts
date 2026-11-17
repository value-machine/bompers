import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  buildTerrainFromLevel,
  clearCrater,
  getCellInfo,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import {
  burningSamples,
  createFireState,
  ignite,
  stepFire,
} from "@/features/fire/services/fireSim";
import type { FireState } from "@/features/fire/types/fire.types";

const F = DEFAULT_GAME_TUNABLES.fire;
const CELL = 4;
const dt = 1 / 120;

const rect = (
  [x, y, w, h]: readonly [number, number, number, number],
  materialId: string
): TerrainPiece => ({ shape: { type: "rect", x, y, w, h }, materialId });

const world = (terrain: TerrainPiece[]): LevelDefinition => ({
  formatVersion: 2,
  meta: { levelId: "f", title: "F" },
  settings: { cellSize: CELL, gravity: 1 },
  worldSize: { w: 400, h: 400 },
  terrain,
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 400, h: 400 },
});

interface Burn {
  grid: TerrainGrid;
  fire: FireState;
  time: number;
  /** Sample index at a world point. */
  at: (x: number, y: number) => number;
  run: (seconds: number) => void;
  light: (x: number, y: number) => void;
}

const burn = (terrain: TerrainPiece[]): Burn => {
  const grid = buildTerrainFromLevel(world(terrain));
  const fire = createFireState(grid);
  const state: Burn = {
    grid,
    fire,
    time: 0,
    at: (x, y) => Math.floor(y / CELL) * grid.widthCells + Math.floor(x / CELL),
    run: (seconds) => {
      const end = state.time + seconds;
      while (state.time < end - 1e-9) {
        state.time += dt;
        stepFire(fire, grid, { now: state.time, tunables: DEFAULT_GAME_TUNABLES });
      }
    },
    light: (x, y) => {
      ignite(fire, grid, { index: state.at(x, y), time: state.time });
    },
  };
  return state;
};

/** Centre of the sample a point is in. */
const centre = (v: number): number => (Math.floor(v / CELL) + 0.5) * CELL;

describe("fireSim — spread (blast-power D5, D6)", () => {
  it("should reach fuel along an axis exactly at distance over spread speed when lit", () => {
    const b = burn([rect([0, 100, 400, 200], "cardboard")]);
    b.light(202, 202);
    b.run(1);
    for (const d of [8, 20, 36]) {
      const arrival = b.fire.igniteAt[b.at(202 + d, 202)]!;
      expect(arrival).toBeCloseTo(d / F.spreadSpeed, 4);
    }
  });

  it("should spread the same in every direction within 8 % when lit in solid fuel", () => {
    const b = burn([rect([0, 100, 400, 200], "cardboard")]);
    b.light(202, 202);
    b.run(1.2);
    for (let deg = 0; deg <= 90; deg += 15) {
      const a = (deg * Math.PI) / 180;
      const x = centre(202 + Math.cos(a) * 40);
      const y = centre(202 + Math.sin(a) * 40);
      const distance = Math.hypot(x - 202, y - 202);
      const arrival = b.fire.igniteAt[b.at(x, y)]!;
      expect(Math.abs(arrival * F.spreadSpeed - distance) / distance, `${deg}°`).toBeLessThan(0.08);
    }
  });

  it("should never cross a gap of air when two fuel pieces are apart", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([144, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    b.run(3);
    expect(b.fire.igniteAt[b.at(150, 110)]).toBe(Infinity);
  });

  it("should not pass through a corner of air when fuel touches only diagonally", () => {
    const b = burn([rect([100, 100, 8, 8], "cardboard"), rect([108, 108, 8, 8], "cardboard")]);
    b.light(102, 102);
    b.run(2);
    expect(b.fire.igniteAt[b.at(110, 110)]).toBe(Infinity);
  });

  it("should flow around stone when stone sits in the fuel", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard"), rect([150, 100, 20, 40], "stone")]);
    b.light(110, 110);
    b.run(5);
    const far = b.at(190, 110);
    expect(b.fire.igniteAt[far]).toBeLessThan(Infinity);
    // The way round the stone is longer than the straight line.
    expect(b.fire.igniteAt[far]! * F.spreadSpeed).toBeGreaterThan(80 + 1);
    expect(b.fire.igniteAt[b.at(158, 110)]).toBe(Infinity);
  });

  it("should scorch earth and stop at it when fire reaches earth", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([140, 100, 40, 40], "earth")]);
    b.light(110, 110);
    b.run(2);
    expect(b.fire.igniteAt[b.at(142, 110)]).toBe(Infinity);
    expect(b.fire.scorched[b.at(142, 110)]).toBe(1);
    expect(getCellInfo(b.grid, 35, 27)?.materialId).toBe("earth");
  });

  it("should never light cardboard touching ice when the fire comes near", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard"), rect([140, 100, 20, 40], "ice")]);
    b.light(110, 110);
    b.run(2);
    expect(b.fire.igniteAt[b.at(138, 110)]).toBe(Infinity);
    expect(b.fire.igniteAt[b.at(130, 110)]).toBeLessThan(Infinity);
  });

  it("should light samples that catch at the same moment in index order when two are lit together", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    ignite(b.fire, b.grid, { index: b.at(130, 110), time: 0 });
    ignite(b.fire, b.grid, { index: b.at(110, 110), time: 0 });
    b.run(dt);
    expect(b.fire.lit.slice(0, 2)).toEqual([b.at(110, 110), b.at(130, 110)]);
  });
});

describe("fireSim — burn-out (blast-power D6)", () => {
  it("should remove a lit sample after the burn time in the next batch when it burns out", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    const index = b.at(110, 110);
    b.run(F.burnSeconds - 0.05);
    expect(getCellInfo(b.grid, 27, 27)).not.toBeNull();
    b.run(0.05 + F.burnOutInterval + dt);
    expect(getCellInfo(b.grid, 27, 27)).toBeNull();
    expect(burningSamples(b.fire)).not.toContain(index);
  });

  it("should report the burnt cardboard once per batch when samples burn out", () => {
    const b = burn([rect([100, 100, 40, 40], "cardboard")]);
    b.light(110, 110);
    const reports: number[] = [];
    for (let t = 0; t < 3; t += dt) {
      b.time += dt;
      const cleared = stepFire(b.fire, b.grid, { now: b.time, tunables: DEFAULT_GAME_TUNABLES });
      if (cleared) reports.push(cleared.byLook[0]?.cells ?? 0);
    }
    expect(reports.length).toBeGreaterThan(1);
    expect(reports.length).toBeLessThanOrEqual(Math.ceil(3 / F.burnOutInterval) + 1);
  });

  it("should keep burning around a crater when a blast removes burning samples", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard")]);
    b.light(110, 110);
    b.run(0.5);
    expect(() => {
      clearCrater(b.grid, { x: 112, y: 112, reach: 12, shape: "round" });
      b.run(3);
    }).not.toThrow();
    expect(b.fire.igniteAt[b.at(200, 150)]).toBeLessThan(Infinity);
  });

  it("should leave fire unlit when a rocket blast cuts cardboard", () => {
    const b = burn([rect([100, 100, 120, 60], "cardboard")]);
    clearCrater(b.grid, { x: 150, y: 100, reach: 34, shape: "round" });
    b.run(1);
    expect(burningSamples(b.fire)).toEqual([]);
  });
});
