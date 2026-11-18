import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";
import { isRolling, reactToHit, rollLockFor, startRoll } from "@/features/player/services/roll";

const T = DEFAULT_GAME_TUNABLES;
const ROLL = T.roll;
const dt = 1 / 120;

// Cell size 4. Flat floor top y = 320 (x 0–1200), wall x 600–616 standing on it.
const FLOOR_Y = 320;
const flat: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 1200, h: 400 },
  terrain: [
    { shape: { type: "rect", x: 0, y: FLOOR_Y, w: 1200, h: 32 }, materialId: "stone" },
    { shape: { type: "rect", x: 600, y: 0, w: 16, h: FLOOR_Y }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 1200, h: 400 },
};

// A 20° slope falling to the right from x 100 to 800, flat on both sides.
const SLOPE = { from: 100, to: 800, top: 120 };
const SLOPE_TAN = Math.tan((20 * Math.PI) / 180);
const slopeY = (x: number): number => SLOPE.top + (x - SLOPE.from) * SLOPE_TAN;
const hill: LevelDefinition = {
  ...flat,
  worldSize: { w: 1000, h: 500 },
  terrain: [
    {
      shape: {
        type: "polygon",
        points: [
          { x: 0, y: SLOPE.top },
          { x: SLOPE.from, y: SLOPE.top },
          { x: SLOPE.to, y: slopeY(SLOPE.to) },
          { x: 1000, y: slopeY(SLOPE.to) },
          { x: 1000, y: 500 },
          { x: 0, y: 500 },
        ],
      },
      materialId: "stone",
    },
  ],
  bounds: { x: 0, y: 0, w: 1000, h: 500 },
};

const createSim = (start: { x: number; y: number }, world: LevelDefinition = flat) => {
  const terrain = buildTerrainFromLevel(world);
  const player = createPlayer(0, start, T);
  const step = (patch: Partial<PlayerInput> = {}, steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = [{ ...EMPTY_PLAYER_INPUT, connected: true, ...patch }];
      stepPlayers({ players: [player], inputs, terrain, tunables: T, dt });
    }
  };
  return { player, step };
};

/** A blob standing still on the 20° slope at x = 300. */
const onSlope = () => {
  const sim = createSim({ x: 300, y: slopeY(300) - 20 }, hill);
  sim.step({}, 60);
  return sim;
};

describe("roll on a hill", () => {
  it("should roll down the hill faster and faster when it starts rolling at rest on a slope", () => {
    const sim = onSlope();
    expect(sim.player.grounded).toBe(true);
    const startX = sim.player.x;
    startRoll(sim.player, { source: "dash" }, T);
    sim.step({ fire: true }, 30);
    const early = sim.player.vx;
    sim.step({ fire: true }, 30);
    expect(early).toBeGreaterThan(0);
    expect(sim.player.vx).toBeGreaterThan(early);
    expect(sim.player.x).toBeGreaterThan(startX + 20);
    // It spins with the ground speed, like a ball: forward (clockwise) going right.
    expect(sim.player.rollSpin).toBeGreaterThan(0);
  });

  it("should stand still on the same slope when it is not rolling", () => {
    const sim = onSlope();
    const startX = sim.player.x;
    sim.step({}, 60);
    expect(sim.player.x).toBeCloseTo(startX, 1);
  });
});

describe("reactToHit strength", () => {
  it("should leave the player alone when the hit's impulse is zero", () => {
    const { player } = createSim({ x: 100, y: FLOOR_Y });
    expect(reactToHit(player, { impulse: { x: 0, y: 0 } }, T)).toBe(false);
    expect(isRolling(player)).toBe(false);
  });

  it("should lock longer the harder the hit when impulses grow from a shove to a blast", () => {
    const locks = [50, 200, 600, 1000, 1400].map((strength) => {
      const { player } = createSim({ x: 100, y: FLOOR_Y });
      reactToHit(player, { impulse: { x: strength, y: 0 } }, T);
      expect(isRolling(player)).toBe(true);
      return player.rollLockSeconds;
    });
    for (let i = 1; i < locks.length; i += 1) {
      expect(locks[i]).toBeGreaterThanOrEqual(locks[i - 1] ?? 0);
    }
    expect(locks[0]).toBeCloseTo(rollLockFor({ x: 50, y: 0 }, ROLL));
    expect(locks[locks.length - 1]).toBeLessThanOrEqual(ROLL.maxLockSeconds);
  });

  it("should roll a hit blob farther the harder it was pushed when both start on the flat", () => {
    const distance = (push: number): number => {
      const sim = createSim({ x: 100, y: FLOOR_Y });
      sim.step({}, 10);
      sim.player.vx = push;
      reactToHit(sim.player, { impulse: { x: push, y: 0 } }, T);
      sim.step({}, 600);
      expect(isRolling(sim.player)).toBe(false);
      return sim.player.x - 100;
    };
    const shove = distance(150);
    const blast = distance(450);
    expect(shove).toBeGreaterThan(0);
    expect(blast).toBeGreaterThan(shove * 2);
  });

  it("should lock a back hit at least the hard lock when its impulse is small", () => {
    const { player } = createSim({ x: 100, y: FLOOR_Y });
    reactToHit(player, { impulse: { x: 10, y: 0 }, hard: true }, T);
    expect(player.rollLockSeconds).toBeGreaterThanOrEqual(ROLL.hardLockSeconds);
  });
});

describe("roll bounces", () => {
  it("should bounce off the floor by restitution and settle when it falls in hard", () => {
    const sim = createSim({ x: 100, y: 100 });
    reactToHit(sim.player, { impulse: { x: 0, y: 900 } }, T);
    sim.player.vy = 900;
    const before = sim.player.rollBounceCount;
    for (let i = 0; i < 200 && sim.player.rollBounceCount === before; i += 1) sim.step();
    expect(sim.player.rollBounceCount).toBe(before + 1);
    expect(sim.player.vy).toBeCloseTo(-sim.player.lastRollBounceSpeed * ROLL.restitution);
    sim.step({}, 900);
    expect(sim.player.grounded).toBe(true);
    expect(isRolling(sim.player)).toBe(false);
  });

  it("should bounce back off a wall when it rolls into it along the floor", () => {
    const sim = createSim({ x: 500, y: FLOOR_Y });
    sim.step({}, 10);
    startRoll(sim.player, { source: "hit", impulse: { x: 800, y: 0 } }, T);
    sim.player.vx = 800;
    for (let i = 0; i < 60 && sim.player.vx > 0; i += 1) sim.step();
    expect(sim.player.vx).toBeLessThan(0);
    expect(sim.player.x + sim.player.width / 2).toBeLessThanOrEqual(600);
  });

  it("should not bounce a blob that is not rolling", () => {
    const sim = createSim({ x: 100, y: 100 });
    sim.player.vy = 600;
    sim.step({}, 60);
    expect(sim.player.rollBounceCount).toBe(0);
    expect(sim.player.y).toBe(FLOOR_Y);
  });
});

describe("roll exits", () => {
  it("should end a dash roll when fire is released", () => {
    const sim = createSim({ x: 100, y: FLOOR_Y });
    sim.step({}, 10);
    startRoll(sim.player, { source: "dash" }, T);
    sim.step({ fire: true }, 5);
    expect(isRolling(sim.player)).toBe(true);
    sim.step({}, 1);
    expect(isRolling(sim.player)).toBe(false);
  });

  it("should block jumping while locked and jump out once the lock ran out", () => {
    const sim = createSim({ x: 100, y: FLOOR_Y });
    sim.step({}, 10);
    reactToHit(sim.player, { impulse: { x: 400, y: 0 } }, T);
    sim.player.vx = 400;
    sim.step({ jump: true }, 2);
    expect(sim.player.jumpCount).toBe(0);
    sim.step({}, Math.ceil(sim.player.rollLockSeconds * 120) + 1);
    expect(isRolling(sim.player)).toBe(true);
    sim.step({ jump: true }, 1);
    expect(sim.player.jumpCount).toBe(1);
    expect(isRolling(sim.player)).toBe(false);
  });

  it("should turn back upright after the roll ends", () => {
    const sim = createSim({ x: 100, y: FLOOR_Y });
    sim.step({}, 10);
    startRoll(sim.player, { source: "dash" }, T);
    sim.player.vx = 300;
    sim.step({ fire: true }, 20);
    expect(sim.player.rollAngle).not.toBe(0);
    sim.step({}, 60);
    expect(sim.player.rollAngle).toBe(0);
  });

  it("should end by time when a roll never comes to rest", () => {
    const sim = createSim({ x: 100, y: 100 });
    startRoll(sim.player, { source: "dash" }, T);
    sim.player.vy = -20000;
    sim.step({ fire: true }, Math.round(ROLL.maxSeconds * 120) + 2);
    expect(isRolling(sim.player)).toBe(false);
  });
});

// Owner bug reports on the ability levels (roll-spin-bounce, 2026-11-18). The ice bowl stands in
// for the chutes of Bobsled Run and Slush Bowl, which are not on main yet.
const bowlPoints = Array.from({ length: 33 }, (_, a) => {
  const t = (Math.PI * a) / 32;
  return { x: 500 - 380 * Math.cos(t), y: 100 + 280 * Math.sin(t) };
});
const iceBowl: LevelDefinition = {
  ...hill,
  terrain: [
    {
      shape: {
        type: "polygon",
        points: [
          { x: 0, y: 100 },
          ...bowlPoints,
          { x: 1000, y: 100 },
          { x: 1000, y: 500 },
          { x: 0, y: 500 },
        ],
      },
      materialId: "ice",
    },
  ],
};
const angleStep = (from: number, to: number): number => {
  const turn = Math.PI * 2;
  return to - from - turn * Math.round((to - from) / turn);
};

/** Heights of the hops a roll makes after it first touches the floor (fire held). */
const hopsAfterLanding = (sim: ReturnType<typeof createSim>, steps: number): number[] => {
  const hops: number[] = [];
  let landed = false;
  let top = FLOOR_Y;
  for (let i = 0; i < steps; i += 1) {
    sim.step({ fire: true });
    const p = sim.player;
    if (!landed) landed = p.grounded || p.rollBounceCount > 0;
    else if (!p.grounded) top = Math.min(top, p.y);
    else if (top < FLOOR_Y - 0.5) {
      hops.push(FLOOR_Y - top);
      top = FLOOR_Y;
    }
  }
  return hops;
};

describe("roll look and bounce (owner bug reports)", () => {
  it("should spin with its speed every step when a dash roll starts in the air and runs through an ice bowl", () => {
    const sim = createSim({ x: 160, y: 50 }, iceBowl);
    startRoll(sim.player, { source: "dash" }, T);
    sim.player.vx = 360;
    const radius = sim.player.width / 2;
    for (let i = 0; i < 240; i += 1) {
      const before = sim.player.rollAngle;
      sim.step({ fire: true });
      const turned = Math.abs(angleStep(before, sim.player.rollAngle));
      if (!sim.player.grounded) {
        // In the air it keeps the rate it had (never 0, also when the roll began in the air).
        expect(turned).toBeGreaterThan(0.5 * dt * Math.abs(sim.player.rollSpin));
        expect(Math.abs(sim.player.rollSpin)).toBeGreaterThan(0);
        continue;
      }
      const speed = Math.hypot(sim.player.vx, sim.player.vy);
      // On the ice it turns with the ground speed, like a ball (at least half the rate).
      if (speed > 60) expect(turned).toBeGreaterThan((0.5 * speed * dt) / radius);
    }
  });

  it("should hop at most once, lower than its own height, when a roll lands from a high fall", () => {
    const sim = createSim({ x: 300, y: FLOOR_Y - 250 });
    startRoll(sim.player, { source: "dash" }, T);
    sim.player.vx = 300;
    const hops = hopsAfterLanding(sim, 400);
    expect(hops.length).toBeLessThanOrEqual(1);
    for (const hop of hops) expect(hop).toBeLessThan(T.player.height);
  });
});
