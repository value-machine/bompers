import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { LevelDefinition, TerrainPiece } from "@/features/level/api/levelApi";
import { createPlayer, type BodyContact, type PlayerState } from "@/features/player/api/playerApi";
import { createFireState, ignite, stepFire, type FireState } from "@/features/fire/api/fireApi";
import {
  catchFire,
  createBlobFireState,
  isBurning,
  panicInputs,
  stepBurningBlobs,
  type StepBurningBlobsArgs,
} from "@/features/blob-fire/services/burningBlobs";
import type { BlobFireState } from "@/features/blob-fire/types/blobFire.types";

const BLOB = DEFAULT_GAME_TUNABLES.fire.blob;
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
  // Stone under a top layer the tests fill (cardboard, ice); the sims here never move the blobs.
  terrain: [rect([0, FLOOR + 8, 600, 40], "stone"), ...terrain],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 600, h: 300 },
});

const blobAt = (slot: number, x: number): PlayerState =>
  createPlayer(slot, { x, y: FLOOR }, DEFAULT_GAME_TUNABLES);

const sampleAt = (grid: TerrainGrid, x: number, y: number): number =>
  Math.floor(y / CELL) * grid.widthCells + Math.floor(x / CELL);
/** A sample of a moving part's own grid, by a point in that grid. */
const sampleIn = sampleAt;

interface World {
  terrain: TerrainGrid;
  fire: FireState;
  blobFire: BlobFireState;
  players: PlayerState[];
}

const world = (terrain: TerrainPiece[], players: PlayerState[]): World => {
  const grid = buildTerrainFromLevel(level(terrain));
  return { terrain: grid, fire: createFireState(grid), blobFire: createBlobFireState(), players };
};

const step = (w: World, now: number, extra: Partial<StepBurningBlobsArgs> = {}) =>
  stepBurningBlobs(w.blobFire, {
    fire: w.fire,
    terrain: w.terrain,
    players: w.players,
    contacts: [],
    isDiving: () => false,
    now,
    tunables: DEFAULT_GAME_TUNABLES,
    ...extra,
  });

const lit = { now: 0, fromX: 100, bySlot: 1 };

const contactOf = (a: PlayerState, b: PlayerState): BodyContact => ({
  a,
  b,
  normal: { x: 1, y: 0 },
  at: { x: (a.x + b.x) / 2, y: a.y },
  aApproachSpeed: 100,
  bApproachSpeed: 0,
  impulse: 100,
});

const input = (patch: Partial<PlayerInput> = {}): PlayerInput => ({
  connected: true,
  moveX: 0,
  aimX: 0,
  aimY: 0,
  jump: false,
  fire: false,
  pause: false,
  crouch: false,
  ...patch,
});

describe("burning blobs — catching (fire-burn D6)", () => {
  it("should catch fire when the blob stands on burning cardboard", () => {
    const w = world([rect([160, FLOOR, 80, 8], "cardboard")], [blobAt(0, 200)]);
    expect(
      ignite(w.fire, w.terrain, { body: 0, index: sampleAt(w.terrain, 201, FLOOR + 1), time: 0 })
    ).toBe(true);
    step(w, 0);
    expect(w.blobFire.blobs.get(w.players[0]!.id)).toMatchObject({ since: 0, bySlot: null });
    expect(w.blobFire.caughtCounts[w.players[0]!.id]).toBe(1);
  });

  it("should not catch fire when the burning cardboard is out of reach", () => {
    const w = world([rect([300, FLOOR, 40, 8], "cardboard")], [blobAt(0, 200)]);
    ignite(w.fire, w.terrain, { body: 0, index: sampleAt(w.terrain, 301, FLOOR + 1), time: 0 });
    step(w, 0);
    expect(w.blobFire.blobs.size).toBe(0);
  });

  it("should catch fire from a burning moving part when the blob stands on it", () => {
    // A cardboard part (piece 1) at x 240–360, y 100–140; one blob on its top, one far away.
    const onPart = createPlayer(0, { x: 252, y: 100 }, DEFAULT_GAME_TUNABLES);
    const far = blobAt(1, 500);
    const grid = buildTerrainFromLevel({
      ...level([rect([240, 100, 120, 40], "cardboard")]),
      movers: [
        {
          motion: { kind: "slide", offset: { x: 0, y: -60 }, periodS: 4, phase: 0 },
          pivot: { x: 300, y: 120 },
          terrainIndices: [1],
        },
      ],
    });
    const w: World = {
      terrain: grid,
      fire: createFireState(grid),
      blobFire: createBlobFireState(),
      players: [onPart, far],
    };
    // Light the part's top row under the blob (the part's own grid, body 1) and let it catch.
    const field = grid.movers[0]!.field;
    const origin = grid.movers[0]!.origin;
    const top = sampleIn(field, 250 - origin.x, 102 - origin.y);
    ignite(w.fire, w.terrain, { body: 1, index: top, time: 0 });
    stepFire(w.fire, w.terrain, { now: 0.1, tunables: DEFAULT_GAME_TUNABLES });
    step(w, 0.1);
    expect(isBurning(w.blobFire, onPart)).toBe(true);
    expect(isBurning(w.blobFire, far)).toBe(false);
  });
});

describe("burning blobs — ending (owner blast-power D7)", () => {
  it("should take one chunk mid-burn and a second at the end with the lighter's credit when standing", () => {
    const w = world([], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    expect(step(w, BLOB.firstTickSeconds - 0.01)).toEqual([]);
    const first = step(w, BLOB.firstTickSeconds);
    expect(first.map((down) => [down.player.slot, down.bySlot])).toEqual([[0, 1]]);
    expect(step(w, BLOB.burnSeconds - 0.01)).toEqual([]);
    const second = step(w, BLOB.burnSeconds);
    expect(second.map((down) => [down.player.slot, down.bySlot])).toEqual([[0, 1]]);
    expect(w.blobFire.blobs.size).toBe(0);
    expect(step(w, BLOB.burnSeconds + 0.01)).toEqual([]);
  });

  it("should skip the second chunk but still go out when the blob is crouching at the end", () => {
    const w = world([], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    w.players[0]!.crouching = true;
    expect(step(w, BLOB.firstTickSeconds)).toHaveLength(1);
    expect(step(w, BLOB.burnSeconds)).toEqual([]);
    expect(w.blobFire.blobs.size).toBe(0);
    expect(w.blobFire.blobMoments.map((moment) => moment.kind)).toEqual(["smoke"]);
  });

  it("should deal no further chunk when ice puts the fire out after the first", () => {
    const w = world([rect([160, FLOOR, 80, 8], "ice")], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    w.blobFire.blobs.get(w.players[0]!.id)!.ticks = 1;
    expect(step(w, BLOB.burnSeconds)).toEqual([]);
    expect(w.blobFire.blobs.size).toBe(0);
  });

  it("should go out with steam when the blob touches ice", () => {
    const w = world([rect([160, FLOOR, 80, 8], "ice")], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    step(w, 0.1);
    expect(w.blobFire.blobs.size).toBe(0);
    expect(w.blobFire.dousedCounts[w.players[0]!.id]).toBe(1);
    expect(w.blobFire.blobMoments.map((moment) => moment.kind)).toEqual(["caught", "steam"]);
  });

  it("should have its flames blown off when the blob dives", () => {
    const w = world([], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    step(w, 0.1, { isDiving: () => true });
    expect(w.blobFire.blobs.size).toBe(0);
    expect(w.blobFire.blobMoments.map((moment) => moment.kind)).toEqual(["caught", "blown"]);
  });

  it("should pass the fire to the rival and not straight back when a burning blob bumps it", () => {
    const burning = blobAt(0, 200);
    const rival = blobAt(1, 228);
    const w = world([], [burning, rival]);
    catchFire(w.blobFire, burning, lit);
    step(w, 0.5, { contacts: [contactOf(burning, rival)] });
    expect(w.blobFire.blobs.has(burning.id)).toBe(false);
    expect(w.blobFire.blobs.get(rival.id)).toMatchObject({ since: 0.5, bySlot: 0, fromX: 200 });
    // Still touching next step: the passer is in its grace and doesn't catch it back.
    step(w, 0.51, { contacts: [contactOf(burning, rival)] });
    expect(w.blobFire.blobs.has(rival.id)).toBe(true);
    expect(w.blobFire.blobs.has(burning.id)).toBe(false);
  });

  it("should forget the fire when the blob leaves play", () => {
    const w = world([], [blobAt(0, 200)]);
    catchFire(w.blobFire, w.players[0]!, lit);
    step(w, 0.1, { players: [] });
    expect(w.blobFire.blobs.size).toBe(0);
  });
});

describe("burning blobs — panic flee (owner fire-burn D2, D3)", () => {
  it("should run away from the fire when a burning blob has no move input", () => {
    const left = blobAt(0, 200);
    const right = blobAt(1, 300);
    const w = world([], [left, right]);
    catchFire(w.blobFire, left, { now: 0, fromX: 250, bySlot: null });
    catchFire(w.blobFire, right, { now: 0, fromX: 250, bySlot: null });
    const moved = panicInputs(w.blobFire, w.players, [input(), input()]);
    expect(moved.map((i) => i.moveX)).toEqual([-1, 1]);
  });

  it("should keep the player's own input when a burning blob is moved or crouched", () => {
    const blob = blobAt(0, 200);
    const w = world([], [blob]);
    catchFire(w.blobFire, blob, { now: 0, fromX: 100, bySlot: null });
    const own = [input({ moveX: -0.5 })];
    expect(panicInputs(w.blobFire, w.players, own)[0]?.moveX).toBe(-0.5);
    expect(panicInputs(w.blobFire, w.players, [input({ crouch: true })])[0]?.moveX).toBe(0);
  });

  it("should leave a blob that isn't burning alone", () => {
    const w = world([], [blobAt(0, 200)]);
    const inputs = [input()];
    expect(panicInputs(w.blobFire, w.players, inputs)).toBe(inputs);
  });
});
