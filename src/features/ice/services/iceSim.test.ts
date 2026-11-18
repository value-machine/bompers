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
/** Samples of ice a ray makes in `seconds`. */
const samplesIn = (seconds: number): number => (I.freezeAreaPerSecond * seconds) / (CELL * CELL);
/** Radius of the round patch that much ice makes inside solid ground. */
const radiusAfter = (seconds: number): number =>
  Math.sqrt((I.freezeAreaPerSecond * seconds) / Math.PI);

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
  /** Frozen samples whose centre is within `radius` of a point (the whole grid without one). */
  count: (near?: { x: number; y: number; radius: number }) => number;
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
    count: (near) => {
      let total = 0;
      grid.frozen.forEach((flag, index) => {
        if (flag !== 1) return;
        const x = ((index % grid.widthCells) + 0.5) * CELL;
        const y = (Math.floor(index / grid.widthCells) + 0.5) * CELL;
        if (!near || Math.hypot(x - near.x, y - near.y) <= near.radius) total += 1;
      });
      return total;
    },
    run: (seconds, on) => {
      const end = state.time + seconds;
      while (state.time < end - 1e-9) {
        state.time += dt;
        if (on) {
          const samples = [state.at(on[0], on[1])];
          feedCold(ice, grid, { slot: 0, samples, now: state.time, dt, tunables: TUNABLES });
        }
        stepIce(ice, grid, { now: state.time });
      }
    },
  };
  return state;
};

describe("iceSim — the cold flows from the beam (ice-element D3, D8)", () => {
  it("should freeze the touched sample at once when a ray touches terrain", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(dt, [202, 202]);
    expect(f.frozen(202, 202)).toBe(true);
  });

  it("should make the same amount of ice per second wherever the beam is held", () => {
    const f = freeze([rect([0, 100, 400, 200], "earth")]);
    f.run(1, [202, 202]);
    expect(Math.abs(f.count() - samplesIn(1))).toBeLessThanOrEqual(2);
  });

  it("should freeze the nearest ground first, so fresh ground gets a round patch", () => {
    const f = freeze([rect([0, 100, 400, 200], "earth")]);
    f.run(1, [202, 202]);
    const r = radiusAfter(1);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
    ] as const) {
      expect(f.frozen(202 + dx * (r - 8), 202 + dy * (r - 8))).toBe(true);
      expect(f.frozen(202 + dx * (r + 10), 202 + dy * (r + 10))).toBe(false);
    }
  });

  it("should stop where it is when the ray lets go", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(0.5, [202, 202]);
    const made = f.count();
    f.run(1);
    expect(f.count()).toBe(made);
  });

  it("should leave an old patch alone when the beam freezes somewhere else on the same ground", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(0.5, [80, 202]);
    const old = { x: 82, y: 202, radius: 60 };
    const before = f.count(old);
    f.run(0.5, [320, 202]);
    expect(f.count(old)).toBe(before);
    expect(f.frozen(320, 202)).toBe(true);
    expect(Math.abs(f.count() - samplesIn(1))).toBeLessThanOrEqual(4);
  });

  it("should push out the nearest edge when the beam is held inside a frozen patch", () => {
    const f = freeze([rect([0, 100, 400, 200], "stone")]);
    f.run(0.5, [202, 202]);
    f.run(0.5);
    // Back on the patch, right of its middle: the right edge is nearer and grows first.
    f.run(0.25, [218, 202]);
    const right = 202 + radiusAfter(0.5) + 6;
    const left = 202 - radiusAfter(0.5) - 6;
    expect(f.frozen(right, 202)).toBe(true);
    expect(f.frozen(left, 202)).toBe(false);
  });

  it("should never cross air when two pieces do not touch", () => {
    const f = freeze([rect([100, 100, 40, 40], "stone"), rect([148, 100, 40, 40], "stone")]);
    f.run(2, [110, 110]);
    expect(f.frozen(136, 110)).toBe(true);
    expect(f.frozen(150, 110)).toBe(false);
  });

  it("should not enter ice terrain when the cold reaches it", () => {
    const f = freeze([rect([100, 100, 40, 40], "stone"), rect([140, 100, 40, 40], "ice")]);
    f.run(2, [110, 110]);
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
    f.run(1, [202, 202]);
    const iceFriction = getCellInfo(f.grid, 2, 82)?.friction;
    expect(iceFriction).toBeLessThan(1);
    expect(groundFrictionBelow(f.grid, span)).toBe(iceFriction);
  });

  it("should leave frozen cardboard whole when a blast would cut it", () => {
    const f = freeze([rect([0, 100, 400, 200], "cardboard")]);
    f.run(3, [202, 102]);
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
      stepIce(f.ice, f.grid, { now: f.time });
      stepFire(fire, f.grid, { now: f.time, tunables: TUNABLES });
    }
  };

  it("should stop a spreading fire at frozen cardboard", () => {
    const f = freeze([rect([0, 100, 400, 40], "cardboard")]);
    f.run(0.5, [202, 118]);
    const fire = createFireState(f.grid);
    ignite(fire, f.grid, { body: 0, index: f.at(120, 118), time: f.time });
    stepBoth(f, fire, 5);
    expect(fire.grounds[0]!.igniteAt[f.at(160, 118)]).toBeLessThan(Infinity);
    expect(fire.grounds[0]!.igniteAt[f.at(202, 118)]).toBe(Infinity);
    expect(f.frozen(202, 118)).toBe(true);
  });

  it("should put out a burning sample when it freezes", () => {
    const f = freeze([rect([0, 100, 400, 40], "cardboard")]);
    const fire = createFireState(f.grid);
    ignite(fire, f.grid, { body: 0, index: f.at(202, 118), time: 0 });
    stepBoth(f, fire, 0.5);
    expect(burningSamples(fire.grounds[0]!)).toContain(f.at(202, 118));
    const now = f.time + dt;
    const samples = [f.at(202, 118)];
    feedCold(f.ice, f.grid, { slot: 0, samples, now, dt, tunables: TUNABLES });
    stepBoth(f, fire, dt);
    expect(burningSamples(fire.grounds[0]!)).not.toContain(f.at(202, 118));
    expect(getCellInfo(f.grid, 50, 29)).not.toBeNull();
  });
});
