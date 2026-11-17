import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { SolidAt } from "@/shared/utils/fallingBody";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import {
  createKnockoutWorld,
  knockoutBodies,
  noteKnockoutEvents,
  pieceAlpha,
  splatAlpha,
  stepKnockouts,
} from "@/features/knockout/services/knockoutSim";
import type { KnockoutWorld } from "@/features/knockout/types/knockout.types";

const T = DEFAULT_GAME_TUNABLES.feel.knockout;
const HEIGHT = DEFAULT_GAME_TUNABLES.player.height;
const RESPAWN = DEFAULT_GAME_TUNABLES.match.respawnDelaySeconds;
const GRAVITY = DEFAULT_GAME_TUNABLES.world.gravity;

/** Floor from y 500 down. */
const floor: SolidAt = (_x, y) => y >= 500;
/** Nothing anywhere: free flight. */
const sky: SolidAt = () => false;

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
    victims: [{ id: "p1", slot: 1, height: HEIGHT }],
    weaponOf: () => (armed ? "rocket-launcher" : null),
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
    expect(body!.x).toBeGreaterThan(400 + 600 * 0.09);
    expect(world.droplets).toEqual([]);
  });

  it("should squash on the spot and burst without flying when the hit is overkill", () => {
    const world = knockedOut(eliminated({ overkill: true, vx: 600, vy: -300 }));
    expect(knockoutBodies(world, T)[0]!.x).toBe(400);
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

describe("knockout — splats", () => {
  it("should keep splats full until the respawn and fade them out by splatSeconds", () => {
    const timing = { respawnDelaySeconds: RESPAWN, splatSeconds: T.splatSeconds };
    expect(splatAlpha(RESPAWN - 0.1, timing)).toBe(1);
    expect(splatAlpha((RESPAWN + T.splatSeconds) / 2, timing)).toBeCloseTo(0.5);
    expect(splatAlpha(T.splatSeconds, timing)).toBe(0);
  });
});
