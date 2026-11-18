import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { SolidAt } from "@/shared/utils/fallingBody";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import { createPlayer, type PlayerState } from "@/features/player/api/playerApi";
import { buildTerrainFromLevel, isSolidAt, type MoverBody } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  createKnockoutWorld,
  CRUSH_PANCAKE,
  knockoutBodies,
  noteKnockoutEvents,
  pieceAlpha,
  stepKnockouts,
  type KnockoutWorld,
} from "@/features/knockout/services/knockoutSim";

const T = DEFAULT_GAME_TUNABLES.feel.knockout;
const RESPAWN = DEFAULT_GAME_TUNABLES.match.respawnDelaySeconds;
const GRAVITY = DEFAULT_GAME_TUNABLES.world.gravity;

/** Floor from y 500 down. */
const floor: SolidAt = (_x, y) => y >= 500;
/** Nothing anywhere: free flight. */
const sky: SolidAt = () => false;

/**
 * Stand-in for the shared roll (match passes the player controller): ballistic motion that
 * reports a blocked move down as a terrain hit, the way the controller does. The roll physics
 * itself is the player feature's, tested there.
 */
const rollOver =
  (solidAt: SolidAt) =>
  (body: PlayerState, dt: number): void => {
    body.terrainHitX = 0;
    body.terrainHitY = 0;
    body.vy += GRAVITY * dt;
    body.x += body.vx * dt;
    const nextY = body.y + body.vy * dt;
    if (body.vy > 0 && solidAt(body.x, nextY)) {
      body.terrainHitY = 1;
      body.terrainHitSpeedY = body.vy;
      body.vy = 0;
      return;
    }
    body.y = nextY;
  };

const eliminated = (
  over: Partial<Extract<CombatEvent, { type: "playerEliminated" }>>
): CombatEvent => ({
  type: "playerEliminated",
  victimSlot: 1,
  byPlayerSlot: 0,
  cause: "dive",
  overkill: false,
  x: 400,
  y: 300,
  vx: 0,
  vy: 0,
  seq: 7,
  timeSeconds: 1,
  ...over,
});

function knockedOut(event: CombatEvent, armed = false): KnockoutWorld {
  const world = createKnockoutWorld();
  noteKnockoutEvents(world, {
    events: [event],
    victims: [createPlayer(1, { x: 0, y: 0 }, DEFAULT_GAME_TUNABLES)],
    weaponOf: () => (armed ? "rocket-launcher" : null),
    tunables: DEFAULT_GAME_TUNABLES,
  });
  return world;
}

/** Steps `seconds` of render time in 60 fps frames. */
function run(world: KnockoutWorld, seconds: number, solidAt: SolidAt = floor): void {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i += 1) {
    stepKnockouts(world, {
      dt: 1 / 60,
      gravity: GRAVITY,
      solidAt,
      roll: rollOver(solidAt),
      tunables: T,
      respawnDelaySeconds: RESPAWN,
    });
  }
}

describe("knockout — start", () => {
  it("should fly with the knockback first when the lethal hit ends exactly at 0 health", () => {
    const world = knockedOut(eliminated({ vx: 600, vy: -300 }));
    run(world, 0.1, sky);
    const [body] = knockoutBodies(world, T);
    expect(body).toMatchObject({ id: "ko-7", victimId: "p1", squash: 0 });
    expect(body!.player.x).toBeGreaterThan(400 + 600 * 0.09);
    expect(body!.player.rollSource).toBe("hit");
    expect(world.droplets).toEqual([]);
  });

  it("should squash on the spot and burst without flying when the hit is overkill", () => {
    const world = knockedOut(eliminated({ overkill: true, vx: 600, vy: -300 }));
    expect(knockoutBodies(world, T)[0]!.player.x).toBe(400);
    run(world, T.squash.seconds + 1 / 60, sky);
    expect(world.knockouts).toEqual([]);
    expect(world.droplets).toHaveLength(T.droplets.count);
  });

  it("should make no knockout when the player fell out of the arena", () => {
    const world = knockedOut(eliminated({ cause: "out-of-bounds" }));
    expect(world.knockouts).toEqual([]);
  });
});

describe("knockout — flight ends", () => {
  it("should squash at the first hard contact when it lands hard before the time limit", () => {
    const world = knockedOut(eliminated({ y: 480, vx: 300, vy: 900 }));
    run(world, 0.15);
    expect(knockoutBodies(world, T)[0]?.squash ?? 1).toBeGreaterThan(0);
    expect(world.knockouts.length + world.droplets.length).toBeGreaterThan(0);
  });

  it("should burst after the time limit when it never touches anything", () => {
    const world = knockedOut(eliminated({ vx: 200, vy: -900 }));
    run(world, T.flungMaxSeconds + T.squash.seconds + 2 / 60, sky);
    expect(world.knockouts).toEqual([]);
    expect(world.droplets).toHaveLength(T.droplets.count);
  });
});

describe("knockout — burst", () => {
  it("should hand the droplets the blob's momentum plus a small spread when it bursts", () => {
    const world = knockedOut(eliminated({ overkill: true, vx: 800, vy: -200 }));
    run(world, T.squash.seconds + 1 / 120, sky);
    for (const droplet of world.droplets) {
      expect(droplet.body.vx).toBeGreaterThan(800 - T.droplets.maxSpread - 1);
      expect(droplet.body.vx).toBeLessThan(800 + T.droplets.maxSpread + 1);
    }
  });

  it("should turn a droplet into a splat with the surface normal the instant it touches the floor", () => {
    const world = knockedOut(eliminated({ overkill: true, y: 499, vx: 0, vy: 400 }));
    run(world, 1);
    expect(world.droplets).toEqual([]);
    expect(world.splats).toHaveLength(T.droplets.count);
    for (const splat of world.splats) expect(splat).toMatchObject({ nx: 0, ny: -1 });
  });

  it("should throw off the helmet and the tube when the victim was armed", () => {
    const world = knockedOut(eliminated({ overkill: true }), true);
    run(world, T.squash.seconds + 1 / 60, sky);
    expect(world.pieces.map((piece) => piece.kind)).toEqual(["helmet", "tube"]);
  });

  it("should remove the pieces at the respawn and blink them just before", () => {
    const world = knockedOut(eliminated({ overkill: true }));
    run(world, RESPAWN - 0.2);
    const helmet = world.pieces[0]!;
    expect([1, 0.2]).toContain(pieceAlpha(helmet, T.blinkSeconds));
    run(world, 0.3);
    expect(world.pieces).toEqual([]);
  });
});

// Ground truth: the owner's crush pick R2A (moving-parts B3): pancake 0.15 s, then splats on both
// faces, the part's riding along.
describe("knockout — crush", () => {
  const crushed = eliminated({ cause: "crush", squeeze: { nx: 1, ny: 0, mover: 0 } });
  const mover = {
    pose: { dx: 0, dy: 0, angle: 0 },
    pivot: { x: 0, y: 0 },
  } as unknown as MoverBody;
  const step = (world: KnockoutWorld, seconds: number) =>
    stepKnockouts(world, {
      dt: seconds,
      gravity: GRAVITY,
      solidAt: sky,
      roll: rollOver(sky),
      movers: [mover],
      tunables: T,
      respawnDelaySeconds: RESPAWN,
    });

  it("should hold a flat pancake across the squeeze, with no flight, when a part crushes the blob", () => {
    const world = knockedOut(crushed);
    step(world, 0.05);
    const [body] = knockoutBodies(world, T);
    expect(body?.pancake).toEqual({ nx: 1, ny: 0 });
    expect(body?.player.x).toBe(400);
    expect(world.splats).toHaveLength(0);
  });

  it("should turn into splats on both faces after the hold, the part's riding along", () => {
    const world = knockedOut(crushed);
    step(world, CRUSH_PANCAKE.holdSeconds + 0.02);
    expect(knockoutBodies(world, T)).toHaveLength(0);
    expect(world.droplets).toHaveLength(0);
    const onPart = world.splats.filter((splat) => splat.rides?.mover === 0);
    const onWall = world.splats.filter((splat) => !splat.rides);
    expect(onPart).toHaveLength(2);
    expect(onWall).toHaveLength(2);
    // The part sits on the -x side (its normal points +x at the blob): its splats face +x.
    expect(onPart.every((splat) => splat.nx === 1 && splat.x < 400)).toBe(true);
    expect(onWall.every((splat) => splat.nx === -1 && splat.x > 400)).toBe(true);
    expect(world.pieces.length).toBeGreaterThan(0);
  });
});

// Ground truth: the owner's stain pick (terrain-stains D1): goo stains the object it lands on,
// so a droplet that lands on a moving part is stored on that part, like a crush's splats.
describe("knockout — droplets on a moving part", () => {
  const level: LevelDefinition = {
    formatVersion: 2,
    meta: { levelId: "m", title: "M" },
    settings: { cellSize: 4, gravity: 1 },
    worldSize: { w: 800, h: 600 },
    terrain: [{ shape: { type: "rect", x: 300, y: 500, w: 200, h: 40 }, materialId: "stone" }],
    movers: [
      {
        motion: { kind: "slide", offset: { x: 60, y: 0 }, periodS: 4, phase: 0 },
        pivot: { x: 400, y: 520 },
        terrainIndices: [0],
      },
    ],
    spawns: [],
    drops: [],
    collectibles: [],
    bounds: { x: -100, y: -100, w: 1000, h: 800 },
  };

  it("should store the stain in the part's rest pose and let it ride when a droplet lands on the part", () => {
    const terrain = buildTerrainFromLevel(level);
    const [mover] = terrain.movers;
    mover!.pose = { dx: 40, dy: 0, angle: 0 };
    const solidAt: SolidAt = (x, y) => isSolidAt(terrain, x, y);
    const world = knockedOut(eliminated({ overkill: true, x: 440, y: 480, vx: 0, vy: 300 }));
    for (let i = 0; i < 60; i += 1) {
      stepKnockouts(world, {
        dt: 1 / 60,
        gravity: GRAVITY,
        solidAt,
        roll: rollOver(solidAt),
        movers: terrain.movers,
        tunables: T,
        respawnDelaySeconds: RESPAWN,
      });
    }
    expect(world.splats.length).toBeGreaterThan(0);
    for (const splat of world.splats) {
      expect(splat.rides).toEqual({ mover: 0 });
      // Rest pose: 40 units back from where it landed on the shifted part (x 340 … 540).
      expect(splat.x).toBeGreaterThan(300 - 1);
      expect(splat.x).toBeLessThan(500 + 1);
    }
  });

  it("should leave a stain on static ground without a part when the droplet lands there", () => {
    const world = knockedOut(eliminated({ overkill: true, y: 499, vx: 0, vy: 400 }));
    run(world, 1);
    expect(world.splats.every((splat) => splat.rides === undefined)).toBe(true);
  });
});
