import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { clearCrater, createArenaState } from "@/features/arena/api/arenaApi";
import { createFireState } from "@/features/fire/api/fireApi";
import { createIceState } from "@/features/ice/api/iceApi";
import { createBlobFireState, isBurning } from "@/features/blob-fire/api/blobFireApi";
import { createPlayer, escapeSolid, type PlayerState } from "@/features/player/api/playerApi";
import {
  createPhysicsObjectsState,
  stepPhysicsObjects,
  type StepPhysicsObjectsArgs,
} from "@/features/physics-objects/services/physicsObjects";
import { circleContact } from "@/features/physics-objects/services/objectMotion";
import type { PhysicsObject } from "@/features/physics-objects/types/physicsObject.types";

const tunables = DEFAULT_GAME_TUNABLES;
const dt = 1 / 120;
const FLOOR = 320;
const R = 24;

/** A flat floor at y = 320 (stone, an earth patch at 440–560), a wall on the left, a 45° ramp on the right; one beach ball. */
function makeLevel(ball: { x: number; bottom: number }): LevelDefinition {
  return {
    formatVersion: 1,
    meta: { levelId: "ball", title: "Ball" },
    settings: { cellSize: 4, gravity: 1 },
    worldSize: { w: 1200, h: 400 },
    terrain: [
      { shape: { type: "rect", x: 0, y: FLOOR, w: 440, h: 40 }, materialId: "stone" },
      // An earth patch under the ball's spot, so a crater can open beneath it.
      { shape: { type: "rect", x: 440, y: FLOOR, w: 120, h: 40 }, materialId: "earth" },
      { shape: { type: "rect", x: 560, y: FLOOR, w: 640, h: 40 }, materialId: "stone" },
      { shape: { type: "rect", x: 0, y: 0, w: 40, h: FLOOR }, materialId: "stone" },
      {
        shape: {
          type: "polygon",
          points: [
            { x: 900, y: FLOOR },
            { x: 1100, y: FLOOR - 200 },
            { x: 1100, y: FLOOR },
          ],
        },
        materialId: "stone",
      },
    ],
    spawns: [
      { x: 300, y: FLOOR },
      { x: 600, y: FLOOR },
    ],
    drops: [],
    collectibles: [],
    bounds: { x: 0, y: 0, w: 1200, h: 400 },
    objects: [
      {
        kind: "ball",
        variant: "beach",
        box: { x: ball.x - R, y: ball.bottom - 2 * R, w: 2 * R, h: 2 * R },
        seed: 1,
        terrainIndices: [],
      },
    ],
  };
}

function world(ball: { x: number; bottom: number } = { x: 500, bottom: FLOOR }) {
  const level = makeLevel(ball);
  const arena = createArenaState(level);
  const state = createPhysicsObjectsState(level);
  const players: PlayerState[] = [];
  const args: StepPhysicsObjectsArgs = {
    terrain: arena.terrain,
    players,
    killZone: { x: -200, y: -400, w: 1600, h: 1000 },
    blasts: [],
    fire: createFireState(arena.terrain),
    ice: createIceState(arena.terrain),
    blobFire: createBlobFireState(),
    isDiving: () => false,
    now: 0,
    dt,
    tunables,
  };
  const ballOf = (): PhysicsObject => state.objects[0]!;
  const run = (seconds: number, each?: () => void) => {
    for (let t = 0; t < seconds; t += dt) {
      each?.();
      stepPhysicsObjects(state, args);
      args.now += dt;
    }
  };
  return { arena, state, args, players, ball: ballOf, run };
}

const blobAt = (at: Vec2, slot = 0): PlayerState => createPlayer(slot, at, tunables);

describe("physicsObjects", () => {
  it("should spawn a ball from a level object resting on its rect's bottom", () => {
    const { ball } = world();
    expect(ball()).toMatchObject({
      kind: "ball",
      variant: "beach",
      radius: R,
      x: 500,
      y: FLOOR - R,
    });
  });

  it("should fall onto the floor and come to rest there when dropped", () => {
    const w = world({ x: 500, bottom: 100 });
    w.run(4);
    expect(w.ball().grounded).toBe(true);
    expect(w.ball().y).toBeCloseTo(FLOOR - R, 0);
    expect(Math.abs(w.ball().vy)).toBeLessThan(5);
  });

  it("should bounce up off the floor by its restitution when it lands fast", () => {
    const w = world({ x: 500, bottom: 100 });
    let rising = false;
    w.run(1.5, () => {
      if (w.ball().vy < -100) rising = true;
    });
    expect(rising).toBe(true);
    expect(w.state.moments.some((moment) => moment.kind === "bounce")).toBe(true);
  });

  it("should roll down a slope and turn as it rolls when placed on it", () => {
    // Halfway up the 45° ramp: the surface there is y = FLOOR - 100 at x = 1000.
    const w = world({ x: 1000, bottom: FLOOR - 120 });
    w.run(2);
    expect(w.ball().x).toBeLessThan(900);
    expect(w.ball().angle).not.toBe(0);
  });

  it("should fall asleep at rest and wake when a blob bumps it", () => {
    const w = world();
    w.run(0.5);
    expect(w.ball().sleepShape).not.toBeNull();
    const blob = blobAt({ x: 500 - R - 10, y: FLOOR });
    blob.vx = 300;
    w.players.push(blob);
    w.run(2 * dt);
    expect(w.ball().sleepShape).toBeNull();
    expect(w.ball().vx).toBeGreaterThan(100);
  });

  it("should wake and fall when the ground under a sleeping ball is cleared", () => {
    const w = world();
    w.run(0.5);
    expect(w.ball().sleepShape).not.toBeNull();
    clearCrater(w.arena.terrain, { x: 500, y: FLOOR + 8, reach: 60, shape: "round" });
    w.run(0.3);
    expect(w.ball().sleepShape).toBeNull();
    expect(w.ball().y).toBeGreaterThan(FLOOR - R + 4);
  });

  it("should be knocked away when a running blob bumps into it", () => {
    const w = world();
    const blob = blobAt({ x: 500 - R - 10, y: FLOOR });
    blob.vx = 300;
    w.players.push(blob);
    w.run(dt);
    expect(w.ball().vx).toBeGreaterThan(300);
  });

  it("should give way so a blob pushing it into a wall never ends inside terrain", () => {
    const w = world({ x: 40 + R, bottom: FLOOR });
    const blob = blobAt({ x: 40 + 2 * R + 10, y: FLOOR });
    w.players.push(blob);
    w.run(1, () => {
      blob.vx = -400;
      blob.x -= 2;
    });
    expect(escapeSolid(blob, w.arena.terrain, { minScale: 0.3 })).toBe("free");
    expect(circleContact(w.arena.terrain, w.ball(), R - 1)).toBeNull();
  });

  it("should be pushed away from a blast by its weight when one goes off beside it", () => {
    const w = world();
    w.args.blasts = [{ at: { x: 470, y: FLOOR - R }, power: 50 }];
    w.run(dt);
    expect(w.ball().vx).toBeGreaterThan(200);
  });
});

describe("physicsObjects — fire, frost and popping", () => {
  it("should burn as a whole, pop when burnt through and come back after 3 s when a torch hits it", () => {
    const w = world();
    w.args.fire.sprays = [
      { slot: 0, origin: { x: 400, y: FLOOR - R }, ends: [{ x: 600, y: FLOOR - R }], atSeconds: 0 },
    ];
    w.run(dt);
    w.args.fire.sprays = [];
    expect(w.ball().state).toMatchObject({ kind: "burning", bySlot: 0 });
    w.run(3.05);
    expect(w.ball().goneUntil).not.toBeNull();
    w.run(3);
    expect(w.ball().goneUntil).toBeNull();
    expect(w.ball().state.kind).toBe("none");
    expect(w.ball().x).toBeCloseTo(500, 0);
  });

  it("should set a blob alight when a burning ball touches it", () => {
    const w = world();
    w.ball().state = { kind: "burning", since: 0, bySlot: 1 };
    const blob = blobAt({ x: 500 - R - 10, y: FLOOR });
    w.players.push(blob);
    w.run(dt);
    expect(isBurning(w.args.blobFire, blob)).toBe(true);
  });

  it("should freeze whole after half a second of freeze ray, slide without turning, and break on a blast", () => {
    const w = world();
    const ray = {
      slot: 0,
      origin: { x: 400, y: FLOOR - R },
      ends: [{ x: 600, y: FLOOR - R }],
      touched: [false],
      atSeconds: 0,
    };
    w.args.ice.rays = [ray];
    w.run(0.55);
    w.args.ice.rays = [];
    expect(w.ball().state.kind).toBe("frozen");
    w.ball().vx = 300;
    const angle = w.ball().angle;
    w.run(0.2);
    expect(w.ball().angle).toBe(angle);
    expect(w.ball().vx).toBeGreaterThan(250);
    w.args.blasts = [{ at: { x: w.ball().x - 40, y: FLOOR - R }, power: 50 }];
    w.run(dt);
    expect(w.ball().state.kind).toBe("none");
  });

  it("should pop and come back at its spot when it leaves the kill zone", () => {
    const w = world();
    w.ball().y = 900;
    w.run(dt);
    expect(w.ball().goneUntil).not.toBeNull();
    w.run(tunables.physicsObjects.respawnSeconds + 0.05);
    expect(w.ball()).toMatchObject({ goneUntil: null, x: 500 });
  });
});
