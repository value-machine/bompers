import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import {
  buildTerrainFromLevel,
  clearCrater,
  type Crater,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { Rect } from "@/shared/types/gameGeometry.types";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";
import { startRoll } from "@/features/player/services/roll";

// Cell size 8. Floor top at y = 320 (x 300 has only the floor below and open sky above). Short wall x 480–496 (y 240–320). Tall wall x 640–656
// (y 0–320). Ledge platform x 80–240, top y = 160.
const stone = (rect: Rect) => ({
  shape: { type: "rect" as const, ...rect },

  materialId: "stone",
});

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [
    stone({ x: 0, y: 320, w: 800, h: 32 }),
    stone({ x: 480, y: 240, w: 16, h: 80 }),
    stone({ x: 640, y: 0, w: 16, h: 320 }),
    stone({ x: 80, y: 160, w: 160, h: 16 }),
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 800, h: 400 },
};

const FLOOR_Y = 320;
const dt = 1 / 120;
const P = DEFAULT_GAME_TUNABLES.player;
const G = DEFAULT_GAME_TUNABLES.world.gravity;

interface Sim {
  player: PlayerState;
  terrain: TerrainGrid;
  step: (patch?: Partial<PlayerInput>, steps?: number) => void;
}

const createSim = (
  start: { x: number; y: number },
  tunables: GameTunables = DEFAULT_GAME_TUNABLES,
  world: LevelDefinition = level
): Sim => {
  const terrain = buildTerrainFromLevel(world);
  const player = createPlayer(0, start, tunables);
  const step = (patch: Partial<PlayerInput> = {}, steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      stepPlayers({
        players: [player],
        inputs: [{ ...EMPTY_PLAYER_INPUT, connected: true, ...patch }],
        terrain,
        tunables,
        dt,
      });
    }
  };
  return { player, terrain, step };
};

/** A player standing still on the floor at x. */
const grounded = (x = 300, tunables?: GameTunables): Sim => {
  const sim = createSim({ x, y: FLOOR_Y - 40 }, tunables);
  sim.step({}, 120);
  return sim;
};

/** Holds jump from standing and returns how far the feet rose at the apex. */
const jumpRise = (sim: Sim, holdSteps: number): number => {
  let minY = sim.player.y;
  for (let i = 0; i < 240; i += 1) {
    sim.step({ jump: i < holdSteps });
    minY = Math.min(minY, sim.player.y);
  }
  return FLOOR_Y - minY;
};

describe("playerController — ground and walls", () => {
  it("should land on the ground and stay grounded when falling with no input", () => {
    const { player } = grounded();
    expect(player.y).toBe(FLOOR_Y);
    expect(player.grounded).toBe(true);
    expect(player.vy).toBe(0);
  });

  it("should stop at a wall instead of passing through when running into it", () => {
    const sim = createSim({ x: 400, y: FLOOR_Y });
    sim.step({ moveX: 1 }, 600);
    expect(sim.player.x + sim.player.width / 2).toBe(480);
  });

  it("should count one landing with its impact speed when dropping onto the floor", () => {
    const sim = createSim({ x: 300, y: 200 });
    sim.step({}, 120);
    expect(sim.player.landCount).toBe(1);
    expect(sim.player.lastLandingSpeed).toBeGreaterThan(500);
  });

  it("should report the ground surface below when airborne within range", () => {
    const near = createSim({ x: 300, y: FLOOR_Y - 100 });
    near.step();
    expect(near.player.groundBelowY).toBe(FLOOR_Y);
    // 300 units up is out of shadow range (240).
    const far = createSim({ x: 300, y: FLOOR_Y - 300 });
    far.step();
    expect(far.player.groundBelowY).toBeNull();
  });
});

describe("playerController — horizontal feel", () => {
  it("should ramp up to run speed over the accel time when run is held from rest", () => {
    const sim = grounded();
    sim.step({ moveX: 1 });
    expect(sim.player.vx).toBeCloseTo(P.groundAccel * dt, 6);
    sim.step({ moveX: 1 }, Math.ceil(P.runSpeed / P.groundAccel / dt));
    expect(sim.player.vx).toBe(P.runSpeed);
  });

  it("should brake to a stop over the decel time when run is released", () => {
    const sim = grounded();
    sim.step({ moveX: 1 }, 30);
    sim.step({}, Math.floor(P.runSpeed / P.groundDecel / dt) - 1);
    expect(sim.player.vx).toBeGreaterThan(0);
    sim.step({}, 2);
    expect(sim.player.vx).toBe(0);
  });

  it("should keep sliding after run is released when standing on ice", () => {
    // Ice overlays the floor at x 0–400 (later unbreakable piece wins); the blob starts at x 300.
    const icy = {
      ...level,
      terrain: [...level.terrain, { ...stone({ x: 0, y: 320, w: 400, h: 32 }), materialId: "ice" }],
    };
    const onIce = createSim({ x: 300, y: FLOOR_Y - 40 }, DEFAULT_GAME_TUNABLES, icy);
    onIce.step({}, 120);
    const onStone = grounded(300);
    const released = [onIce, onStone].map((sim) => {
      sim.step({ moveX: -1 }, 40);
      const before = sim.player.vx;
      sim.step({}, Math.ceil(P.runSpeed / P.groundDecel / dt) + 1);
      return { before, after: sim.player.vx };
    });
    expect(released[1]!.after).toBe(0);
    expect(released[0]!.before).toBeLessThan(0);
    expect(released[0]!.after).toBeLessThan(released[0]!.before * 0.5);
  });

  it("should reverse with the stronger turn accel when the direction flips", () => {
    const sim = grounded();
    sim.step({ moveX: 1 }, 30);
    sim.step({ moveX: -1 });
    expect(sim.player.vx).toBeCloseTo(P.runSpeed - P.turnAccel * dt, 6);
    expect(sim.player.facing).toBe(-1);
  });

  it("should steer with air accel when moving while airborne", () => {
    const sim = createSim({ x: 300, y: 100 });
    sim.step({ moveX: 1 });
    expect(sim.player.vx).toBeCloseTo(P.airAccel * dt, 6);
  });
});

describe("playerController — jumping", () => {
  it("should peak at jumpSpeed² / 2g when jump is held", () => {
    const rise = jumpRise(grounded(), 240);
    expect(Math.abs(rise - (P.jumpSpeed * P.jumpSpeed) / (2 * G))).toBeLessThan(P.jumpSpeed * dt);
  });

  // Owner feedback round 2 § 3: the previously shipped pair (gravity 2200, jumpSpeed 1050) reached
  // its apex too fast to coordinate trick jumps. The jump must hang at least 20 % longer and reach
  // about the same height.
  it("should hang 20 % longer at the old apex height when jump is held at default tunables", () => {
    const old = { gravity: 2200, jumpSpeed: 1050 };
    const oldApexSeconds = old.jumpSpeed / old.gravity;
    const oldApex = (old.jumpSpeed * old.jumpSpeed) / (2 * old.gravity);
    const sim = grounded();
    const startY = sim.player.y;
    let minY = startY;
    let apexStep = 0;
    for (let i = 0; i < 240; i += 1) {
      sim.step({ jump: true });
      if (sim.player.y < minY) {
        minY = sim.player.y;
        apexStep = i;
      }
    }
    expect(apexStep * dt).toBeGreaterThanOrEqual(oldApexSeconds * 1.2);
    expect(Math.abs(startY - minY - oldApex) / oldApex).toBeLessThan(0.05);
  });

  it("should jump twice as high when gravity is halved", () => {
    const low: GameTunables = {
      ...DEFAULT_GAME_TUNABLES,
      world: { ...DEFAULT_GAME_TUNABLES.world, gravity: G / 2 },
    };
    const normal = jumpRise(grounded(), 240);
    const moon = jumpRise(grounded(300, low), 240);
    expect(moon / normal).toBeCloseTo(2, 1);
  });

  it("should jump lower when jump is released early", () => {
    const full = jumpRise(grounded(), 240);
    const short = jumpRise(grounded(), 4);
    expect(short).toBeLessThan(full * 0.5);
    expect(short).toBeGreaterThan(0);
  });

  it("should count a jump and not refire while jump stays held", () => {
    const sim = grounded();
    jumpRise(sim, 240);
    expect(sim.player.jumpCount).toBe(1);
  });

  it("should still jump when pressed within coyote time after running off a ledge", () => {
    const sim = createSim({ x: 220, y: 120 });
    sim.step({}, 60);
    while (sim.player.grounded) sim.step({ moveX: 1 });
    sim.step({ moveX: 1 }, Math.floor(P.coyoteTime / dt) - 2);
    sim.step({ jump: true });
    expect(sim.player.jumpCount).toBe(1);
    expect(sim.player.vy).toBeLessThan(0);
  });

  it("should not jump when pressed after coyote time has run out", () => {
    const sim = createSim({ x: 220, y: 120 });
    sim.step({}, 60);
    while (sim.player.grounded) sim.step({ moveX: 1 });
    sim.step({ moveX: 1 }, Math.ceil(P.coyoteTime / dt) + 2);
    sim.step({ jump: true });
    expect(sim.player.jumpCount).toBe(0);
  });

  it("should jump on landing when jump was pressed within the buffer time before", () => {
    const sim = createSim({ x: 300, y: 200 });
    // Fall until the next ~3 steps reach the floor, then press jump (before touching down).
    while (sim.player.y + sim.player.vy * dt * 3 < FLOOR_Y) sim.step();
    expect(sim.player.grounded).toBe(false);
    sim.step({ jump: true }, 20);
    expect(sim.player.jumpCount).toBe(1);
  });

  it("should ignore a jump pressed longer than the buffer time before landing", () => {
    const sim = createSim({ x: 300, y: 100 });
    sim.step({ jump: true }, 2);
    sim.step({}, 120);
    expect(sim.player.landCount).toBe(1);
    expect(sim.player.jumpCount).toBe(0);
  });
});

describe("playerController — wall slide and wall-jump", () => {
  // Body right edge touches the tall wall at x 640.
  const atWall = (): Sim => {
    const sim = createSim({ x: 640 - P.width / 2, y: 120 });
    sim.step({ moveX: 1 }, 4);
    return sim;
  };

  it("should cap the fall at wall-slide speed when pushing into a wall in the air", () => {
    const sim = atWall();
    sim.step({ moveX: 1 }, 30);
    expect(sim.player.wallDir).toBe(1);
    expect(sim.player.vy).toBeLessThanOrEqual(P.wallSlideSpeed);
    expect(sim.player.vy).toBeGreaterThan(0);
  });

  it("should launch up and away from the wall when jumping while touching it", () => {
    const sim = atWall();
    sim.step({ moveX: 1 }, 10);
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.wallJumpCount).toBe(1);
    expect(sim.player.vx).toBeLessThan(0);
    expect(sim.player.vy).toBeLessThan(0);
    expect(sim.player.facing).toBe(-1);
  });

  it("should keep moving away during the control lock even when pushing back toward the wall", () => {
    const sim = atWall();
    sim.step({ moveX: 1, jump: true });
    sim.step({ moveX: 1 }, Math.floor(P.wallJumpControlLock / dt) - 1);
    expect(sim.player.vx).toBeLessThan(0);
  });
});

describe("playerController — aim", () => {
  it("should aim along facing when there is no aim input", () => {
    const sim = grounded();
    sim.step({ moveX: -1 });
    expect([sim.player.aimX, sim.player.aimY]).toEqual([-1, 0]);
  });

  it("should store a unit aim vector when aim input is given", () => {
    const sim = grounded();
    sim.step({ aimX: 3, aimY: 4 });
    expect(sim.player.aimX).toBeCloseTo(0.6, 6);
    expect(sim.player.aimY).toBeCloseTo(0.8, 6);
  });
});

describe("playerController — crouch", () => {
  it("should stop walking and keep turning when crouch is held on the ground", () => {
    const sim = grounded();
    sim.step({ moveX: 1 }, 60);
    sim.step({ moveX: -1, crouch: true }, 30);
    expect(sim.player.crouching).toBe(true);
    expect(sim.player.vx).toBe(0);
    expect(sim.player.facing).toBe(-1);
    const x = sim.player.x;
    sim.step({ moveX: -1, crouch: true }, 30);
    expect(sim.player.x).toBe(x);
  });

  it("should count one crouch start and stand up when crouch is released", () => {
    const sim = grounded();
    sim.step({ crouch: true }, 10);
    expect(sim.player.crouchCount).toBe(1);
    sim.step({}, 1);
    expect(sim.player.crouching).toBe(false);
  });

  it("should not crouch when crouch is held in the air", () => {
    const sim = createSim({ x: 300, y: 100 });
    sim.step({ crouch: true }, 5);
    expect(sim.player.crouching).toBe(false);
  });

  it("should jump out of a crouch when jump is pressed", () => {
    const sim = grounded();
    sim.step({ crouch: true }, 10);
    sim.step({ crouch: true, jump: true }, 1);
    expect(sim.player.crouching).toBe(false);
    expect(sim.player.vy).toBeLessThan(0);
  });
});

// A curved hill: a dome (circle r 160 centred under the floor) on a flat floor, 4-unit samples,
// the way a crater rim or authored curve reads after the distance-field laps.
const hill: LevelDefinition = {
  ...level,
  settings: { cellSize: 4, gravity: 1 },
  terrain: [
    stone({ x: 0, y: 320, w: 800, h: 32 }),
    { shape: { type: "circle" as const, cx: 500, cy: 420, r: 160 }, materialId: "earth" },
  ],
};

describe("playerController — curved slopes", () => {
  it("should walk up and over a curved hill when the player holds a direction", () => {
    const sim = createSim({ x: 300, y: FLOOR_Y - 40 }, DEFAULT_GAME_TUNABLES, hill);
    sim.step({}, 60);
    let peak = sim.player.y;
    for (let i = 0; i < 360 && sim.player.x < 680; i += 1) {
      sim.step({ moveX: 1 });
      peak = Math.min(peak, sim.player.y);
    }
    expect(sim.player.x).toBeGreaterThan(680);
    // Crossed the dome top (y 260) on foot, not around it.
    expect(peak).toBeLessThanOrEqual(264);
  });

  it("should stay on the ground without new landings when the player walks down the far side", () => {
    const sim = createSim({ x: 500, y: 240 }, DEFAULT_GAME_TUNABLES, hill);
    sim.step({}, 60);
    const landings = sim.player.landCount;
    for (let i = 0; i < 120; i += 1) sim.step({ moveX: 1 });
    expect(sim.player.x).toBeGreaterThan(600);
    expect(sim.player.landCount).toBe(landings);
  });

  it("should still stop at a wall taller than the step-up when walking into it", () => {
    const sim = grounded(400);
    for (let i = 0; i < 120; i += 1) sim.step({ moveX: 1 });
    expect(sim.player.x).toBeLessThan(480);
  });
});

// Slope walking (slope-walking D1, D8): an earth slab (4-unit samples) with a fresh rocket crater,
// and a 30° ramp. Steady speeds come from the shipped rule: runSpeed × (1 ∓ loss × sin θ).
const SLAB_TOP = 200;
const earthWorld: LevelDefinition = {
  ...level,
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 600, h: 400 },
  terrain: [{ shape: { type: "rect", x: 0, y: SLAB_TOP, w: 600, h: 200 }, materialId: "earth" }],
  bounds: { x: 0, y: 0, w: 600, h: 400 },
};
const rocketCrater: Crater = { x: 300, y: SLAB_TOP, reach: 34, shape: "round" };

/** A blob dropped into a fresh rocket crater in the earth slab, settled at its bottom. */
const inCrater = (): Sim => {
  const sim = createSim({ x: 300, y: 225 }, DEFAULT_GAME_TUNABLES, earthWorld);
  clearCrater(sim.terrain, rocketCrater);
  sim.step({}, 120);
  return sim;
};

const RAMP = { from: 100, to: 700, base: 380 };
const RAMP_TAN = Math.tan(Math.PI / 6);
const rampY = (x: number): number => RAMP.base - (x - RAMP.from) * RAMP_TAN;
const rampWorld: LevelDefinition = {
  ...level,
  settings: { cellSize: 4, gravity: 1 },
  worldSize: { w: 900, h: 420 },
  terrain: [
    {
      shape: {
        type: "polygon",
        points: [
          { x: 0, y: RAMP.base },
          { x: RAMP.from, y: RAMP.base },
          { x: RAMP.to, y: rampY(RAMP.to) },
          { x: 900, y: rampY(RAMP.to) },
          { x: 900, y: 420 },
          { x: 0, y: 420 },
        ],
      },
      materialId: "stone",
    },
  ],
  bounds: { x: 0, y: 0, w: 900, h: 420 },
};

/** Mean speed while the blob crosses the span holding `moveX`. */
const meanSpeedAcross = (sim: Sim, span: { fromX: number; toX: number; moveX: number }): number => {
  const low = Math.min(span.fromX, span.toX);
  const high = Math.max(span.fromX, span.toX);
  const speeds: number[] = [];
  for (let i = 0; i < 1200; i += 1) {
    sim.step({ moveX: span.moveX });
    const inside = sim.player.x >= low && sim.player.x <= high;
    if (inside) speeds.push(Math.hypot(sim.player.vx, sim.player.vy));
    if (!inside && speeds.length > 0) break;
  }
  return speeds.reduce((sum, v) => sum + v, 0) / Math.max(1, speeds.length);
};

describe("playerController — leaving the ground (slope-walking A1, A9)", () => {
  it("should fly off a ledge keeping its run speed when running off the edge", () => {
    // The ledge platform: x 80–240, top y 160.
    const sim = createSim({ x: 120, y: 120 });
    sim.step({}, 120);
    for (let i = 0; i < 120 && sim.player.x < 250; i += 1) sim.step({ moveX: 1 });
    expect(sim.player.grounded).toBe(false);
    expect(sim.player.vx).toBeGreaterThan(P.runSpeed * 0.9);
  });

  it("should leave the ground when knocked upward while standing", () => {
    const sim = grounded();
    sim.player.vy = -400;
    sim.step();
    expect(sim.player.grounded).toBe(false);
    expect(sim.player.y).toBeLessThan(FLOOR_Y);
  });

  it("should keep its run speed and add the jump along the ramp's normal when jumping uphill", () => {
    const sim = createSim({ x: 40, y: RAMP.base - 30 }, DEFAULT_GAME_TUNABLES, rampWorld);
    sim.step({}, 60);
    for (let i = 0; i < 240 && sim.player.x < 450; i += 1) sim.step({ moveX: 1 });
    const before = sim.player.vx;
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.grounded).toBe(false);
    // The 30° normal kicks back down the ramp by jumpSpeed · sin 30° (slope-jump D2).
    expect(sim.player.vx).toBeCloseTo(before - P.jumpSpeed * Math.sin(Math.PI / 6), -1);
  });

  it("should stand still on a slope when there is no input", () => {
    const sim = createSim({ x: 400, y: rampY(400) - 30 }, DEFAULT_GAME_TUNABLES, rampWorld);
    sim.step({}, 120);
    const at = { x: sim.player.x, y: sim.player.y };
    sim.step({}, 240);
    expect(Math.abs(sim.player.x - at.x)).toBeLessThan(0.5);
    expect(Math.abs(sim.player.y - at.y)).toBeLessThan(0.5);
  });
});

describe("playerController — slope walking", () => {
  it("should walk out of a fresh rocket crater without jumping when starting at its bottom", () => {
    const sim = inCrater();
    expect(sim.player.y).toBeGreaterThan(SLAB_TOP + 20);
    // 0.75 s: out of the crater and onto the slab top, well before its far edge (x 600).
    sim.step({ moveX: 1 }, 90);
    expect(sim.player.x).toBeGreaterThan(rocketCrater.x + rocketCrater.reach + 14);
    expect(sim.player.y).toBeCloseTo(SLAB_TOP, 0);
    expect(sim.player.jumpCount).toBe(0);
  });

  it("should move without a position jump when walking over the crater rim", () => {
    const sim = inCrater();
    let largest = 0;
    const landings = sim.player.landCount;
    for (let i = 0; i < 90; i += 1) {
      const before = { x: sim.player.x, y: sim.player.y };
      sim.step({ moveX: 1 });
      largest = Math.max(largest, Math.hypot(sim.player.x - before.x, sim.player.y - before.y));
    }
    expect(largest).toBeLessThanOrEqual(P.runSpeed * dt + 0.5);
    // On the ground all the way: no hop off the lip and no landing (A9).
    expect(sim.player.landCount).toBe(landings);
  });

  it("should settle at the slower uphill speed when walking up a 30° ramp", () => {
    const sim = createSim({ x: 40, y: RAMP.base - 30 }, DEFAULT_GAME_TUNABLES, rampWorld);
    sim.step({}, 60);
    const mean = meanSpeedAcross(sim, { fromX: 450, toX: 600, moveX: 1 });
    const expected = P.runSpeed * (1 - P.slope.uphillLoss * Math.sin(Math.PI / 6));
    expect(Math.abs(mean - expected) / expected).toBeLessThan(0.05);
  });

  it("should settle at the faster downhill speed when walking down a 30° ramp", () => {
    const sim = createSim({ x: 860, y: rampY(RAMP.to) - 30 }, DEFAULT_GAME_TUNABLES, rampWorld);
    sim.step({}, 60);
    const mean = meanSpeedAcross(sim, { fromX: 450, toX: 300, moveX: -1 });
    const expected = P.runSpeed * (1 + P.slope.downhillGain * Math.sin(Math.PI / 6));
    expect(Math.abs(mean - expected) / expected).toBeLessThan(0.05);
  });

  it("should report the ground angle under the feet when standing on a ramp", () => {
    const sim = createSim({ x: 400, y: rampY(400) - 30 }, DEFAULT_GAME_TUNABLES, rampWorld);
    sim.step({}, 120);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.groundAngle).toBeCloseTo(Math.PI / 6, 1);
  });
});

describe("playerController — air jump presses (double-jump-bash D2, D3)", () => {
  /** Jumps from the floor, lets go, and returns once high in the air and rising. */
  const highInTheAir = (): Sim => {
    const sim = grounded();
    sim.step({ jump: true }, 2);
    sim.step({}, 30);
    return sim;
  };

  it("should count one air press when jump is pressed high in the air", () => {
    const sim = highInTheAir();
    sim.step({ jump: true }, 10);
    expect(sim.player.airJumpPressCount).toBe(1);
    expect(sim.player.jumpCount).toBe(1);
  });

  it("should not count the press that jumps off the ground", () => {
    const sim = grounded();
    sim.step({ jump: true });
    expect(sim.player.jumpCount).toBe(1);
    expect(sim.player.airJumpPressCount).toBe(0);
  });

  it("should not count a coyote jump just after walking off a ledge", () => {
    const sim = createSim({ x: 230, y: 120 });
    sim.step({}, 60);
    for (let i = 0; i < 120 && sim.player.grounded; i += 1) sim.step({ moveX: 1 });
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.jumpCount).toBe(1);
    expect(sim.player.airJumpPressCount).toBe(0);
  });

  it("should keep a press just above the floor for the landing jump instead of counting it", () => {
    const sim = createSim({ x: 300, y: FLOOR_Y - 120 });
    for (let i = 0; i < 200 && FLOOR_Y - sim.player.y > 8; i += 1) sim.step();
    sim.step({ jump: true });
    sim.step({ jump: true }, 20);
    expect(sim.player.airJumpPressCount).toBe(0);
    expect(sim.player.jumpCount).toBe(1);
  });

  it("should wall-jump instead of counting a press made while touching a wall", () => {
    const sim = createSim({ x: 640 - P.width / 2, y: 120 });
    sim.step({ moveX: 1 }, 14);
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.wallJumpCount).toBe(1);
    expect(sim.player.airJumpPressCount).toBe(0);
  });

  it("should still wall-jump from a press made just before reaching the wall", () => {
    const sim = createSim({ x: 640 - P.width / 2 - 3, y: 120 });
    sim.step({}, 2);
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.wallDir).toBe(0);
    sim.step({ moveX: 1, jump: true }, 6);
    expect(sim.player.wallJumpCount).toBe(1);
  });

  it("should count a held jump once and a press made while locked once the lock ends", () => {
    const sim = highInTheAir();
    sim.player.jumpLocked = true;
    sim.step({ jump: true }, 4);
    expect(sim.player.airJumpPressCount).toBe(0);
    sim.player.jumpLocked = false;
    sim.step({ jump: true }, 10);
    expect(sim.player.airJumpPressCount).toBe(1);
  });
});

describe("playerController — roll carry (double-jump-bash D11)", () => {
  const ROLL = DEFAULT_GAME_TUNABLES.roll;
  /** Rolls along the floor at `speed` (fire held), then jumps holding right; returns the reach. */
  const jumpReach = (speed: number | null): { reach: number; takeOffVx: number } => {
    const sim = createSim({ x: 40, y: FLOOR_Y - 40 });
    sim.step({}, 60);
    if (speed !== null) {
      startRoll(sim.player, { source: "dash" }, DEFAULT_GAME_TUNABLES);
      sim.player.vx = speed;
    } else sim.step({ moveX: 1 }, 60);
    const from = sim.player.x;
    sim.step({ moveX: 1, jump: true, fire: speed !== null });
    const takeOffVx = sim.player.vx;
    for (let i = 0; i < 400 && !sim.player.grounded; i += 1) sim.step({ moveX: 1, jump: true });
    return { reach: sim.player.x - from, takeOffVx };
  };

  it("should jump clearly farther out of a fast roll than from a full run", () => {
    const run = jumpReach(null).reach;
    const rolled = jumpReach(ROLL.jumpCarryMax).reach;
    expect(rolled).toBeGreaterThan(run * 1.25);
  });

  it("should cap the speed a jump keeps from a very fast roll", () => {
    expect(jumpReach(2000).takeOffVx).toBeCloseTo(ROLL.jumpCarryMax);
  });

  it("should steer a blast's speed back down as before when the jump did not come out of a roll", () => {
    const sim = grounded();
    sim.step({ jump: true });
    sim.player.vx = 900;
    sim.step({ moveX: 1, jump: true }, 24);
    expect(sim.player.airCarrySpeed).toBe(0);
    expect(sim.player.vx).toBeLessThan(900 - P.airAccel * 0.15);
  });

  it("should drop the carry when the stick lets go and when it lands", () => {
    const sim = createSim({ x: 40, y: FLOOR_Y - 40 });
    sim.step({}, 60);
    startRoll(sim.player, { source: "dash" }, DEFAULT_GAME_TUNABLES);
    sim.player.vx = 500;
    sim.step({ moveX: 1, jump: true, fire: true });
    expect(sim.player.airCarrySpeed).toBeGreaterThan(P.runSpeed);
    sim.step({ jump: true });
    expect(sim.player.airCarrySpeed).toBe(0);
    sim.step({}, 300);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.airCarrySpeed).toBe(0);
  });
});

// Slope limit and slope jumps (slope-jump D1, D2): a 0–90° quarter arc (radius 160, polygon in 3°
// facets, like an SVG arc) and straight ramps of any angle off a floor at y 380.
const ARC_R = 160;
const arcWorld: LevelDefinition = {
  ...level,
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 900, h: 420 },
  terrain: [
    {
      shape: {
        type: "polygon",
        points: [
          { x: 0, y: 380 },
          ...Array.from({ length: 31 }, (_, i) => {
            const a = (i * 3 * Math.PI) / 180;
            return { x: 400 + ARC_R * Math.sin(a), y: 380 - ARC_R + ARC_R * Math.cos(a) };
          }),
          { x: 400 + ARC_R, y: 0 },
          { x: 900, y: 0 },
          { x: 900, y: 420 },
          { x: 0, y: 420 },
        ],
      },
      materialId: "stone",
    },
  ],
  bounds: { x: 0, y: 0, w: 900, h: 420 },
};

/** Floor at y 380 up to x 300, then a straight ramp at `deg` up to y 60, then a plateau. */
const angledRamp = (deg: number): LevelDefinition => {
  const topX = 300 + 320 / Math.tan((deg * Math.PI) / 180);
  return {
    ...level,
    settings: { cellSize: 8, gravity: 1 },
    worldSize: { w: 1400, h: 420 },
    terrain: [
      {
        shape: {
          type: "polygon",
          points: [
            { x: 0, y: 380 },
            { x: 300, y: 380 },
            { x: topX, y: 60 },
            { x: 1400, y: 60 },
            { x: 1400, y: 420 },
            { x: 0, y: 420 },
          ],
        },
        materialId: "stone",
      },
    ],
    bounds: { x: 0, y: 0, w: 1400, h: 420 },
  };
};

/** A blob standing still halfway up a straight ramp of `deg`. */
const onRamp = (deg: number): Sim => {
  const midX = 300 + 160 / Math.tan((deg * Math.PI) / 180);
  const sim = createSim({ x: midX - 20, y: 150 }, DEFAULT_GAME_TUNABLES, angledRamp(deg));
  sim.step({}, 120);
  return sim;
};

/** Sideways tilt of a wall-jump launch: the most a slope jump leans from straight up. */
const MAX_JUMP_TILT = Math.atan2(P.wallJumpSpeedX, P.wallJumpSpeedY);

describe("playerController — slope limit (slope-jump D1)", () => {
  it("should come to rest at the limit with no oscillation when holding into a quarter arc", () => {
    const sim = createSim({ x: 250, y: 350 }, DEFAULT_GAME_TUNABLES, arcWorld);
    sim.step({}, 60);
    sim.step({ moveX: 1 }, 360);
    const at = { x: sim.player.x, y: sim.player.y };
    const landings = sim.player.landCount;
    let flips = 0;
    for (let i = 0; i < 240; i += 1) {
      const was = sim.player.grounded;
      sim.step({ moveX: 1 });
      if (sim.player.grounded !== was) flips += 1;
      expect(Math.abs(sim.player.x - at.x)).toBeLessThan(0.01);
      expect(Math.abs(sim.player.y - at.y)).toBeLessThan(0.01);
    }
    expect(flips).toBe(0);
    expect(sim.player.grounded).toBe(true);
    expect(sim.player.landCount).toBe(landings);
    // Up the arc, at about the walkable limit (80°), and no further.
    const limitDeg = (sim.player.groundAngle * 180) / Math.PI;
    expect(limitDeg).toBeGreaterThan(75);
    expect(limitDeg).toBeLessThan(88);
  });

  it("should stay put at the limit when the stick is let go", () => {
    const sim = createSim({ x: 250, y: 350 }, DEFAULT_GAME_TUNABLES, arcWorld);
    sim.step({}, 60);
    sim.step({ moveX: 1 }, 360);
    const at = { x: sim.player.x, y: sim.player.y };
    sim.step({}, 120);
    expect(Math.abs(sim.player.x - at.x)).toBeLessThan(0.5);
    expect(Math.abs(sim.player.y - at.y)).toBeLessThan(0.5);
    expect(sim.player.grounded).toBe(true);
  });

  it("should slide down instead of landing when falling onto ground steeper than the limit", () => {
    // Dropped against an 86° ramp: a steep fall lands on the floor at its foot.
    const sim = createSim({ x: 300, y: 150 }, DEFAULT_GAME_TUNABLES, angledRamp(86));
    sim.step({}, 240);
    expect(sim.player.grounded).toBe(true);
    // Down in the corner at the ramp's foot (the circle touches floor and ramp), landed once.
    expect(sim.player.y).toBeGreaterThan(370);
    expect(sim.player.x).toBeLessThan(300);
    expect(sim.player.landCount).toBe(1);
  });
});

describe("playerController — slope jumps (slope-jump D2)", () => {
  it.each([30, 50, 70])(
    "should jump along the ground normal when jumping from a %i° slope",
    (deg) => {
      const sim = onRamp(deg);
      const jumps = sim.player.jumpCount;
      sim.step({ jump: true });
      expect(sim.player.jumpCount).toBe(jumps + 1);
      expect(sim.player.grounded).toBe(false);
      // Launch direction (gravity's one step taken back out): the normal, leaning back down the
      // ramp, at most as far as a wall-jump leans.
      const tilt = Math.atan2(-sim.player.vx, -(sim.player.vy - G * dt));
      expect(tilt).toBeCloseTo(Math.min((deg * Math.PI) / 180, MAX_JUMP_TILT), 1);
      expect(Math.hypot(sim.player.vx, sim.player.vy - G * dt)).toBeCloseTo(P.jumpSpeed, -1);
    }
  );

  it("should still jump straight up on flat ground", () => {
    const sim = grounded();
    sim.step({ jump: true });
    expect(sim.player.vx).toBe(0);
  });

  it("should rise at least as high as a wall-jump when jumping from a steep slope", () => {
    const sim = onRamp(70);
    const startY = sim.player.y;
    let minY = startY;
    for (let i = 0; i < 120; i += 1) {
      sim.step({ jump: true });
      minY = Math.min(minY, sim.player.y);
    }
    const wallJumpApex = P.wallJumpSpeedY ** 2 / (2 * G);
    expect(startY - minY).toBeGreaterThan(wallJumpApex * 0.95);
  });

  it("should clear a 70° slope when jumping while walking up it", () => {
    const sim = onRamp(70);
    sim.step({ moveX: 1 }, 12);
    const sin = Math.sin((70 * Math.PI) / 180);
    const cos = Math.cos((70 * Math.PI) / 180);
    // Distance of the feet from the ramp line, out of the slope.
    const offSlope = (): number => (sim.player.x - 300) * -sin + (sim.player.y - 380) * -cos;
    const start = offSlope();
    sim.step({ moveX: 1, jump: true }, 24);
    expect(offSlope() - start).toBeGreaterThan(P.width);
  });

  it("should jump off the arc like a wall-jump when resting at the limit", () => {
    const sim = createSim({ x: 250, y: 350 }, DEFAULT_GAME_TUNABLES, arcWorld);
    sim.step({}, 60);
    sim.step({ moveX: 1 }, 360);
    const jumps = sim.player.jumpCount;
    sim.step({ moveX: 1, jump: true });
    expect(sim.player.jumpCount).toBe(jumps + 1);
    expect(sim.player.vx).toBeLessThan(0);
    expect(Math.atan2(-sim.player.vx, -sim.player.vy)).toBeCloseTo(MAX_JUMP_TILT, 1);
  });
});
