import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  buildTerrainFromLevel,
  clearCrater,
  getCellInfo,
  groundFrictionBelow,
  isFrozenSample,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import { burningSamples, createFireState, ignite, stepFire } from "@/features/fire/api/fireApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { createIceState, feedCold, stepIce } from "@/features/ice/services/iceSim";
import type { IceState } from "@/features/ice/types/ice.types";

const TUNABLES = DEFAULT_GAME_TUNABLES;
const I = TUNABLES.ice;
const CELL = 4;
const dt = 1 / 120;
/** Seconds of feeding the cold needs to spread `units` world units. */
const feedFor = (units: number): number => units / I.spreadSpeed;

const rect = (
  [x, y, w, h]: readonly [number, number, number, number],
  materialId: string
): TerrainPiece => ({ shape: { type: "rect", x, y, w, h }, materialId });

const world = (terrain: TerrainPiece[]): LevelDefinition => ({
  formatVersion: 2,
  meta: { levelId: "i", title: "I" },
  settings: { cellSize: CELL, gravity: 1 },
  worldSize: { w: 400, h: 400 },
  terrain,
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 400, h: 400 },
});

interface Freeze {
  grid: TerrainGrid;
  ice: IceState;
  time: number;
  /** Sample index at a world point. */
  at: (x: number, y: number) => number;
  frozen: (x: number, y: number) => boolean;
  /** Steps `seconds` with a ray on the sample at `on` every step, or with no ray. */
  run: (seconds: number, on?: readonly [number, number]) => void;
}

const freeze = (terrain: TerrainPiece[]): Freeze => {
  const grid = buildTerrainFromLevel(world(terrain));
  const ice = createIceState(grid);
  const state: Freeze = {
    grid,
    ice,
    time: 0,
    at: (x, y) => Math.floor(y / CELL) * grid.widthCells + Math.floor(x / CELL),
    frozen: (x, y) => isFrozenSample(grid, state.at(x, y)),
    run: (seconds, on) => {
      const end = state.time + seconds;
      while (state.time < end - 1e-9) {
        state.time += dt;
        if (on) feedCold(ice, grid, { index: state.at(on[0], on[1]), now: state.time });
        stepIce(ice, grid, { now: state.time, dt, tunables: TUNABLES });
      }
    },
  };
  return state;
};

describe("iceSim — spread while fed (ice-element D3, D4)", () => {
  it("should freeze the touched sample at once when a ray touches terrain", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(dt, [202, 202]);
    expect(f.frozen(202, 202)).toBe(true);
  });

  it("should spread the same distance every way through terrain while the ray feeds it", () => {
    const f = freeze([rect([0, 100, 400, 200], "earth")]);
    f.run(feedFor(40), [202, 202]);
    for (const [dx, dy] of [
      [32, 0],
      [-32, 0],
      [0, 32],
      [0, -32],
      [22, 22],
    ] as const) {
      expect(f.frozen(202 + dx, 202 + dy)).toBe(true);
    }
    for (const [dx, dy] of [
      [52, 0],
      [0, 52],
      [38, 38],
    ] as const) {
      expect(f.frozen(202 + dx, 202 + dy)).toBe(false);
    }
  });

  it("should stop where it is when the ray lets go", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(feedFor(20), [202, 202]);
    f.run(1);
    expect(f.frozen(202 + 12, 202)).toBe(true);
    expect(f.frozen(202 + 32, 202)).toBe(false);
  });

  it("should grow on from its edge when a ray feeds it again", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(feedFor(20), [202, 202]);
    f.run(0.5);
    f.run(feedFor(20), [202, 202]);
    expect(f.frozen(202 + 32, 202)).toBe(true);
  });

  it("should never cross air when two pieces do not touch", () => {
    const f = freeze([rect([100, 100, 40, 40], "stone"), rect([148, 100, 40, 40], "stone")]);
    f.run(feedFor(120), [110, 110]);
    expect(f.frozen(136, 110)).toBe(true);
    expect(f.frozen(150, 110)).toBe(false);
  });

  it("should not enter ice terrain when the cold reaches it", () => {
    const f = freeze([rect([100, 100, 40, 40], "stone"), rect([140, 100, 40, 40], "ice")]);
    f.run(feedFor(120), [110, 110]);
    expect(f.frozen(136, 110)).toBe(true);
    expect(f.frozen(150, 110)).toBe(false);
  });
});

describe("iceSim — thaw (ice-element D5)", () => {
  it("should thaw by itself after the frozen time when nothing else thaws it", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(dt, [202, 202]);
    f.run(I.frozenSeconds - 0.1);
    expect(f.frozen(202, 202)).toBe(true);
    f.run(0.2);
    expect(f.frozen(202, 202)).toBe(false);
  });

  it("should freeze a thawed sample again when a ray touches it later", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(dt, [202, 202]);
    f.run(I.frozenSeconds + 0.1);
    f.run(dt, [202, 202]);
    expect(f.frozen(202, 202)).toBe(true);
  });
});

describe("frozen ground behaves like ice (ice-element D5)", () => {
  it("should grip like the ice material when stone is frozen", () => {
    const f = freeze([rect([0, 200, 400, 100], "stone"), rect([0, 320, 40, 40], "ice")]);
    const span = { x: 190, y: 200, w: 24 };
    expect(groundFrictionBelow(f.grid, span)).toBe(1);
    f.run(feedFor(40), [202, 202]);
    const iceFriction = getCellInfo(f.grid, 2, 82)?.friction;
    expect(iceFriction).toBeLessThan(1);
    expect(groundFrictionBelow(f.grid, span)).toBe(iceFriction);
  });

  it("should leave frozen cardboard whole when a blast would cut it", () => {
    const f = freeze([rect([0, 100, 400, 200], "cardboard")]);
    f.run(feedFor(60), [202, 102]);
    const cleared = clearCrater(f.grid, { x: 202, y: 100, reach: 30, shape: "round" });
    expect(cleared.removed).toBe(0);
    expect(getCellInfo(f.grid, 50, 26)).not.toBeNull();
  });
});

describe("ice and fire (ice-element D6)", () => {
  const stepBoth = (f: Freeze, fire: ReturnType<typeof createFireState>, seconds: number) => {
    const end = f.time + seconds;
    while (f.time < end - 1e-9) {
      f.time += dt;
      stepIce(f.ice, f.grid, { now: f.time, dt, tunables: TUNABLES });
      stepFire(fire, f.grid, { now: f.time, tunables: TUNABLES });
    }
  };

  it("should stop a spreading fire at frozen cardboard", () => {
    const f = freeze([rect([0, 100, 400, 40], "cardboard")]);
    f.run(feedFor(20), [202, 118]);
    const fire = createFireState(f.grid);
    ignite(fire, f.grid, { index: f.at(120, 118), time: f.time });
    stepBoth(f, fire, 4);
    expect(fire.igniteAt[f.at(170, 118)]).toBeLessThan(Infinity);
    expect(fire.igniteAt[f.at(202, 118)]).toBe(Infinity);
    expect(f.frozen(202, 118)).toBe(true);
  });

  it("should put out a burning sample when it freezes", () => {
    const f = freeze([rect([0, 100, 400, 40], "cardboard")]);
    const fire = createFireState(f.grid);
    ignite(fire, f.grid, { index: f.at(202, 118), time: 0 });
    stepBoth(f, fire, 0.5);
    expect(burningSamples(fire)).toContain(f.at(202, 118));
    feedCold(f.ice, f.grid, { index: f.at(202, 118), now: f.time + dt });
    stepBoth(f, fire, dt);
    expect(burningSamples(fire)).not.toContain(f.at(202, 118));
    expect(getCellInfo(f.grid, 50, 29)).not.toBeNull();
  });
});
