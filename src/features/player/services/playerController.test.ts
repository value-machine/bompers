import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel, type LevelData } from "@/features/arena/api/arenaApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";
import type { PlayerState } from "@/features/player/types/player.types";

// Cell size 8. Floor top at y = 320 (x 300 has only the floor below and open sky above). Short wall x 480–496 (y 240–320). Tall wall x 640–656
// (y 0–320). Ledge platform x 80–240, top y = 160.
const level: LevelData = {
  id: "test",
  name: "Test",
  cellSize: 8,
  widthCells: 100,
  heightCells: 50,
  blocks: [
    { x: 0, y: 40, width: 100, height: 4, kind: "solid" },
    { x: 60, y: 30, width: 2, height: 10, kind: "solid" },
    { x: 80, y: 0, width: 2, height: 40, kind: "solid" },
    { x: 10, y: 20, width: 20, height: 2, kind: "solid" },
  ],
  spawnPoints: [],
  dropPoints: [],
  outOfBounds: { x: 0, y: 0, width: 800, height: 400 },
};

const FLOOR_Y = 320;
const dt = 1 / 120;
const P = DEFAULT_GAME_TUNABLES.player;
const G = DEFAULT_GAME_TUNABLES.world.gravity;

interface Sim {
  player: PlayerState;
  step: (patch?: Partial<PlayerInput>, steps?: number) => void;
}

const createSim = (
  start: { x: number; y: number },
  tunables: GameTunables = DEFAULT_GAME_TUNABLES
): Sim => {
  const terrain = buildTerrainFromLevel(level);
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
  return { player, step };
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
