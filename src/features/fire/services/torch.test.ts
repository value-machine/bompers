import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  buildTerrainFromLevel,
  isFrozenSample,
  setSampleFrozen,
} from "@/features/arena/api/arenaApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { createPlayer } from "@/features/player/api/playerApi";
import { createFireState } from "@/features/fire/services/fireSim";
import { sprayTorch } from "@/features/fire/services/torch";

const T = DEFAULT_GAME_TUNABLES.combat.torch;
const CELL = 4;
const FLOOR = 200;

const rect = (
  [x, y, w, h]: readonly [number, number, number, number],
  materialId: string
): TerrainPiece => ({ shape: { type: "rect", x, y, w, h }, materialId });

const level = (terrain: TerrainPiece[]): LevelDefinition => ({
  formatVersion: 2,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: CELL, gravity: 1 },
  worldSize: { w: 600, h: 300 },
  terrain: [rect([0, FLOOR, 600, 40], "stone"), ...terrain],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 600, h: 300 },
});

/** A blob standing at x on the floor, aiming right. */
const blobAt = (slot: number, x: number) => {
  const player = createPlayer(slot, { x, y: FLOOR }, DEFAULT_GAME_TUNABLES);
  player.aimX = 1;
  player.aimY = 0;
  return player;
};

const sampleAt = (grid: ReturnType<typeof buildTerrainFromLevel>, x: number, y: number) =>
  Math.floor(y / CELL) * grid.widthCells + Math.floor(x / CELL);

describe("torch (blast-power D8)", () => {
  it("should light the first fuel each ray meets when sprayed at cardboard", () => {
    // Cardboard wall 40 units right of the helmet (inside the 84-unit cone).
    const terrain = buildTerrainFromLevel(level([rect([240, 120, 40, 80], "cardboard")]));
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    sprayTorch(fire, {
      terrain,
      players: [holder],
      holder,
      tunables: DEFAULT_GAME_TUNABLES,
      now: 0,
      dt: 1 / 120,
    });
    const helmetY = FLOOR - holder.height * 0.78;
    expect(fire.igniteAt[sampleAt(terrain, 241, helmetY)]).toBe(0);
    // Behind the first sample nothing is lit by the spray itself.
    expect(fire.igniteAt[sampleAt(terrain, 260, helmetY)]).toBe(Infinity);
  });

  it("should not light fuel behind stone when stone stands in the cone", () => {
    const terrain = buildTerrainFromLevel(
      level([rect([220, 100, 8, 100], "stone"), rect([240, 120, 40, 80], "cardboard")])
    );
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    sprayTorch(fire, {
      terrain,
      players: [holder],
      holder,
      tunables: DEFAULT_GAME_TUNABLES,
      now: 0,
      dt: 1 / 120,
    });
    const helmetY = FLOOR - holder.height * 0.78;
    expect(fire.igniteAt[sampleAt(terrain, 241, helmetY)]).toBe(Infinity);
  });

  it("should push a blob in the cone along the aim and not one behind a wall", () => {
    const terrain = buildTerrainFromLevel(level([rect([330, 100, 8, 100], "stone")]));
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    const near = blobAt(1, 250);
    const walled = blobAt(2, 350);
    const dt = 1 / 120;
    sprayTorch(fire, {
      terrain,
      players: [holder, near, walled],
      holder,
      tunables: DEFAULT_GAME_TUNABLES,
      now: 0,
      dt,
    });
    expect(near.vx).toBeCloseTo(T.push * dt, 6);
    expect(walled.vx).toBe(0);
    expect(holder.vx).toBe(0);
  });

  it("should record the spray with one end per ray when it sprays", () => {
    const terrain = buildTerrainFromLevel(level([]));
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    sprayTorch(fire, {
      terrain,
      players: [holder],
      holder,
      tunables: DEFAULT_GAME_TUNABLES,
      now: 1,
      dt: 1 / 120,
    });
    expect(fire.sprays).toHaveLength(1);
    expect(fire.sprays[0]!.ends).toHaveLength(T.rays);
  });
});

describe("torch on frozen terrain (ice-element D6)", () => {
  it("should thaw frozen cardboard first and light it on a later step (ice-element D6)", () => {
    const terrain = buildTerrainFromLevel(level([rect([240, 120, 40, 80], "cardboard")]));
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    const helmetY = FLOOR - holder.height * 0.78;
    const touched = sampleAt(terrain, 241, helmetY);
    setSampleFrozen(terrain, touched, true);
    const spray = (now: number): void =>
      sprayTorch(fire, {
        terrain,
        players: [holder],
        holder,
        tunables: DEFAULT_GAME_TUNABLES,
        now,
        dt: 1 / 120,
      });
    spray(0);
    expect(isFrozenSample(terrain, touched)).toBe(false);
    expect(fire.igniteAt[touched]).toBe(Infinity);
    spray(1 / 120);
    expect(fire.igniteAt[touched]).toBeLessThan(Infinity);
  });

  it("should thaw frozen stone and never light it", () => {
    const terrain = buildTerrainFromLevel(level([rect([240, 120, 40, 80], "stone")]));
    const fire = createFireState(terrain);
    const holder = blobAt(0, 200);
    const touched = sampleAt(terrain, 241, FLOOR - holder.height * 0.78);
    setSampleFrozen(terrain, touched, true);
    for (const now of [0, 1 / 120]) {
      sprayTorch(fire, {
        terrain,
        players: [holder],
        holder,
        tunables: DEFAULT_GAME_TUNABLES,
        now,
        dt: 1 / 120,
      });
    }
    expect(isFrozenSample(terrain, touched)).toBe(false);
    expect(fire.igniteAt[touched]).toBe(Infinity);
  });
});
