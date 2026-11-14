import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";
import { isTumbling, reactToHit, startTumble } from "@/features/player/services/tumble";

// Cell size 8. Floor top y = 320, x 0–1200. Wall x 600–616 from y 0 to the floor.
const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 1200, h: 400 },
  terrain: [
    {
      shape: { type: "rect", x: 0, y: 320, w: 1200, h: 32 },
      role: "platform",
      materialId: "stone",
    },
    { shape: { type: "rect", x: 600, y: 0, w: 16, h: 320 }, role: "platform", materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 1200, h: 400 },
};

const FLOOR_Y = 320;
const dt = 1 / 120;
const T = DEFAULT_GAME_TUNABLES;
const TUMBLE = T.tumble;

const createSim = (start: { x: number; y: number }) => {
  const terrain = buildTerrainFromLevel(level);
  const player = createPlayer(0, start, T);
  const step = (patch: Partial<PlayerInput> = {}, steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = [{ ...EMPTY_PLAYER_INPUT, connected: true, ...patch }];
      stepPlayers({ players: [player], inputs, terrain, tunables: T, dt });
    }
  };
  return { player, step };
};

/** Steps until the bounce counter moves; returns the velocity right after that bounce. */
const stepToNextBounce = (sim: ReturnType<typeof createSim>) => {
  const before = sim.player.tumbleBounceCount;
  for (let i = 0; i < 600 && sim.player.tumbleBounceCount === before; i += 1) sim.step();
  return { vx: sim.player.vx, vy: sim.player.vy, speed: sim.player.lastTumbleBounceSpeed };
};

describe("reactToHit", () => {
  it("should start a tumble when the impulse reaches the hard-hit threshold", () => {
    const { player } = createSim({ x: 100, y: FLOOR_Y });
    expect(reactToHit(player, { impulse: { x: TUMBLE.minImpulse, y: 0 } }, T)).toBe(true);
    expect(isTumbling(player)).toBe(true);
    expect(player.tumbleBouncesLeft).toBe(TUMBLE.bounces);
  });

  it("should leave a light hit alone when the impulse is below the threshold", () => {
    const { player } = createSim({ x: 100, y: FLOOR_Y });
    expect(reactToHit(player, { impulse: { x: TUMBLE.minImpulse - 1, y: 0 } }, T)).toBe(false);
    expect(isTumbling(player)).toBe(false);
  });

  it("should start a tumble on a light hit when the attack marks it hard", () => {
    const { player } = createSim({ x: 100, y: FLOOR_Y });
    expect(reactToHit(player, { impulse: { x: 10, y: 0 }, hard: true }, T)).toBe(true);
  });
});

describe("tumble", () => {
  it("should bounce off the floor with decaying restitution when a tumbling blob lands hard", () => {
    const sim = createSim({ x: 100, y: 100 });
    startTumble(sim.player, T);
    sim.player.vy = 600;
    const first = stepToNextBounce(sim);
    expect(first.vy).toBeCloseTo(-first.speed * TUMBLE.restitution);
    const second = stepToNextBounce(sim);
    expect(second.vy).toBeCloseTo(-second.speed * TUMBLE.restitution * TUMBLE.restitutionDecay);
    expect(Math.abs(second.vy)).toBeLessThan(Math.abs(first.vy));
  });

  it("should bounce off a wall and scrub speed along the floor when thrown sideways", () => {
    const sim = createSim({ x: 500, y: 200 });
    startTumble(sim.player, T);
    sim.player.vx = 900;
    const bounce = stepToNextBounce(sim);
    // Air drag takes a little off before the wall; the bounce reflects the speed it arrived with.
    expect(bounce.speed).toBeGreaterThan(800);
    expect(bounce.vx).toBeCloseTo(-bounce.speed * TUMBLE.restitution);
    expect(sim.player.x + sim.player.width / 2).toBeLessThanOrEqual(600);
    const vxBeforeFloor = sim.player.vx;
    stepToNextBounce(sim);
    expect(Math.abs(sim.player.vx)).toBeLessThan(Math.abs(vxBeforeFloor));
  });

  it("should stop bouncing after the tuned number of bounces and recover on the ground", () => {
    const sim = createSim({ x: 100, y: 0 });
    startTumble(sim.player, T);
    sim.player.vy = 1200;
    sim.step({}, 400);
    expect(sim.player.tumbleBounceCount).toBeLessThanOrEqual(TUMBLE.bounces);
    expect(sim.player.grounded).toBe(true);
    expect(isTumbling(sim.player)).toBe(false);
  });

  it("should end by time when the blob never comes to rest", () => {
    const sim = createSim({ x: 100, y: 100 });
    startTumble(sim.player, T);
    sim.player.vy = -3000;
    sim.step({}, Math.round(TUMBLE.maxSeconds * 120) + 2);
    expect(isTumbling(sim.player)).toBe(false);
  });

  it("should lock jump and limit steering while tumbling", () => {
    const tumbling = createSim({ x: 100, y: 100 });
    const free = createSim({ x: 100, y: 100 });
    startTumble(tumbling.player, T);
    tumbling.step({ moveX: 1, jump: true }, 10);
    free.step({ moveX: 1 }, 10);
    expect(tumbling.player.vy).toBeGreaterThan(0);
    expect(tumbling.player.vx).toBeGreaterThan(0);
    expect(tumbling.player.vx).toBeCloseTo(free.player.vx * TUMBLE.steerScale);
  });

  it("should not bounce a blob that is not tumbling", () => {
    const sim = createSim({ x: 100, y: 100 });
    sim.player.vy = 600;
    sim.step({}, 60);
    expect(sim.player.tumbleBounceCount).toBe(0);
    expect(sim.player.y).toBe(FLOOR_Y);
  });
});
