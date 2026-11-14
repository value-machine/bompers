import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  createPlayer,
  resolveBodyContacts,
  stepPlayers,
  type PlayerState,
} from "@/features/player/api/playerApi";
import { createDiveState, selectDiveOption, stepDives } from "@/features/dive/services/diveSim";
import type { DiveHit, DivePhase } from "@/features/dive/types/dive.types";

// Cell size 8. Floor top y = 320. Thin wall (one cell) x 600–608, y 0–320. Open sky elsewhere.
const stone = (rect: Rect) => ({
  shape: { type: "rect" as const, ...rect },
  role: "platform" as const,
  materialId: "stone",
});
const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 1200, h: 400 },
  terrain: [stone({ x: 0, y: 320, w: 1200, h: 32 }), stone({ x: 600, y: 0, w: 8, h: 320 })],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: 0, w: 1200, h: 400 },
};

const FLOOR_Y = 320;
const HZ = 120;
const dt = 1 / HZ;
const T = DEFAULT_GAME_TUNABLES;
const OPTIONS = T.dive.options;
const optionIndex = (id: string): number => OPTIONS.findIndex((option) => option.id === id);
const frames = (seconds: number): number => Math.round(seconds * HZ);

type InputPatch = Partial<PlayerInput>;

/** The match's steps 2, 2b and 3a on a small world; players start standing on the floor. */
const createSim = (id: string, starts: number[], tunables: GameTunables = T) => {
  const terrain = buildTerrainFromLevel(level);
  const players = starts.map((x, slot) => createPlayer(slot, { x, y: FLOOR_Y }, tunables));
  const dive = createDiveState();
  selectDiveOption(dive, optionIndex(id), tunables);
  const hits: DiveHit[] = [];
  const step = (patches: InputPatch[] = [], steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = players.map((_, slot) => ({
        ...EMPTY_PLAYER_INPUT,
        connected: true,
        ...patches[slot],
      }));
      stepPlayers({ players, inputs, terrain, tunables, dt });
      const contacts = resolveBodyContacts({ players, terrain, tunables });
      hits.push(...stepDives({ dive, players, inputs, contacts, tunables, dt }));
    }
  };
  step(); // settle on the floor (grounded, dive charged)
  const phaseOf = (player: PlayerState): DivePhase => dive.motions[player.id]!.phase;
  return { players, dive, hits, step, phaseOf };
};

/** Steps with `patch` for player 0 until its phase changes; returns the steps that took. */
const stepsUntilPhaseChange = (sim: ReturnType<typeof createSim>, patch: InputPatch = {}) => {
  const start = sim.phaseOf(sim.players[0]!);
  let count = 0;
  while (sim.phaseOf(sim.players[0]!) === start && count < 1000) {
    sim.step([patch]);
    count += 1;
  }
  return count;
};

const RIGHT: InputPatch = { fire: true, aimX: 1 };

describe("stepDives timeline", () => {
  it.each(OPTIONS.map((option) => [option.id, option] as const))(
    "should run %s through wind-up, travel and recovery for the tuned number of steps when fire is pressed",
    (id, option) => {
      const sim = createSim(id, [100]);
      const player = sim.players[0]!;
      sim.step([RIGHT]);
      expect(sim.phaseOf(player)).toBe("windup");
      expect(stepsUntilPhaseChange(sim)).toBe(frames(option.windupSeconds));
      expect(sim.phaseOf(player)).toBe("travel");
      expect(Math.hypot(player.vx, player.vy)).toBeCloseTo(option.launchSpeed, 0);
      // Open ground, no jump press: only the timer (or, for a bouncing option, landing) ends it.
      const travel = stepsUntilPhaseChange(sim);
      expect(travel).toBeLessThanOrEqual(frames(option.travelSeconds));
      if (!option.endOnGround) expect(travel).toBe(frames(option.travelSeconds));
      expect(sim.phaseOf(player)).toBe("recovery");
      expect(stepsUntilPhaseChange(sim)).toBe(frames(option.recoverySeconds));
      expect(sim.phaseOf(player)).toBe("idle");
    }
  );

  it("should fly the cannonball straight for launchSpeed × travelSeconds when nothing is in the way", () => {
    const option = OPTIONS[optionIndex("cannonball")]!;
    const sim = createSim("cannonball", [100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    const startX = player.x;
    stepsUntilPhaseChange(sim);
    expect(player.x - startX).toBeCloseTo(option.launchSpeed * option.travelSeconds, 0);
    expect(player.y).toBe(FLOOR_Y);
  });

  it("should not start a dive again when fire stays held", () => {
    const sim = createSim("snap", [100]);
    sim.step([RIGHT], 240);
    expect(sim.phaseOf(sim.players[0]!)).toBe("idle");
  });

  it("should wait for the cooldown before the next dive when fire is pressed again at once", () => {
    const option = OPTIONS[optionIndex("snap")]!;
    const sim = createSim("snap", [100]);
    sim.step([RIGHT]);
    while (sim.phaseOf(sim.players[0]!) !== "idle") sim.step();
    sim.step([RIGHT]);
    expect(sim.phaseOf(sim.players[0]!)).toBe("idle");
    sim.step([], frames(option.cooldownSeconds));
    sim.step([RIGHT]);
    expect(sim.phaseOf(sim.players[0]!)).toBe("windup");
  });

  it("should allow only one dive per airtime when diving upward", () => {
    const sim = createSim("snap", [100]);
    const player = sim.players[0]!;
    player.y = 60;
    player.grounded = false;
    sim.step([{ fire: true, aimY: -1 }]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    sim.step([], 40);
    expect(player.grounded).toBe(false);
    sim.step([{ fire: true, aimY: -1 }]);
    expect(sim.phaseOf(player)).toBe("idle");
    while (!player.grounded) sim.step();
    sim.step([{ fire: true, aimY: -1 }]);
    expect(sim.phaseOf(player)).toBe("windup");
  });

  it("should end the snap early when jump is pressed inside the cancel window", () => {
    const sim = createSim("snap", [100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    sim.step([], 8);
    expect(sim.phaseOf(player)).toBe("travel");
    sim.step([{ jump: true }]);
    expect(sim.phaseOf(player)).toBe("idle");
    expect(player.jumpLocked).toBe(false);
  });

  it("should hand steering and gravity back to the controller when the dive is over", () => {
    const sim = createSim("cannonball", [100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    expect(player.steerScale).toBe(0);
    expect(player.gravityScale).toBe(0);
    while (sim.phaseOf(player) !== "idle") sim.step();
    expect(player.steerScale).toBe(1);
    expect(player.gravityScale).toBe(1);
    expect(player.jumpLocked).toBe(false);
  });
});

describe("stepDives terrain", () => {
  it.each(OPTIONS.map((option) => option.id))(
    "should not tunnel %s through a one-cell wall when diving into it",
    (id) => {
      const sim = createSim(id, [520]);
      sim.step([RIGHT]);
      sim.step([], 200);
      expect(sim.players[0]!.x + sim.players[0]!.width / 2).toBeLessThanOrEqual(600);
    }
  );

  it("should not tunnel through a one-cell wall when the launch speed is far above the tuned one", () => {
    const fast: GameTunables = {
      ...T,
      dive: {
        ...T.dive,
        options: OPTIONS.map((option) => ({ ...option, launchSpeed: 6000, maxSpeed: 6000 })),
      },
    };
    const sim = createSim("cannonball", [300], fast);
    sim.step([RIGHT]);
    sim.step([], 200);
    expect(sim.players[0]!.x + sim.players[0]!.width / 2).toBeLessThanOrEqual(600);
  });

  it("should stun the cannonball and throw it back when it hits a wall head-on", () => {
    const option = OPTIONS[optionIndex("cannonball")]!;
    const sim = createSim("cannonball", [520]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    stepsUntilPhaseChange(sim);
    expect(sim.phaseOf(player)).toBe("recovery");
    expect(sim.dive.motions[player.id]!.bonked).toBe(true);
    expect(player.vx).toBeCloseTo(-option.launchSpeed * option.bonkRebound);
    expect(stepsUntilPhaseChange(sim)).toBe(frames(option.bonkStunSeconds));
  });

  it("should bounce the pogo off the floor and keep the dive active when it dives down", () => {
    const option = OPTIONS[optionIndex("pogo")]!;
    const sim = createSim("pogo", [100]);
    const player = sim.players[0]!;
    player.y = 200;
    player.grounded = false;
    sim.step([{ fire: true, aimY: 1 }]);
    stepsUntilPhaseChange(sim);
    let bounced = false;
    for (let i = 0; i < 60 && !bounced; i += 1) {
      sim.step();
      bounced = player.vy < 0;
    }
    expect(bounced).toBe(true);
    expect(sim.phaseOf(player)).toBe("travel");
    expect(sim.dive.motions[player.id]!.bouncesLeft).toBe(option.terrainBounces - 1);
  });
});

describe("stepDives hits", () => {
  it.each(OPTIONS.map((option) => option.id))(
    "should land exactly one front hit with %s and send the victim away when diving at a blob that faces the attacker",
    (id) => {
      const sim = createSim(id, [100, 150]);
      const [attacker, victim] = sim.players as [PlayerState, PlayerState];
      victim.facing = -1;
      sim.step([RIGHT]);
      sim.step([], 120);
      expect(sim.hits).toHaveLength(1);
      expect(sim.hits[0]).toMatchObject({
        attackerSlot: attacker.slot,
        victimSlot: victim.slot,
        kind: "contact",
        source: "dive",
        zone: "front",
        damage: T.dive.frontHitDamage,
      });
      expect(sim.hits[0]!.impulse.x).toBeGreaterThan(0);
      expect(victim.x).toBeGreaterThan(150 + 20);
      expect(sim.dive.tallies[victim.slot]).toMatchObject({ frontTaken: 1, damageTaken: 1 });
      expect(sim.dive.tallies[attacker.slot]?.dealt).toBe(1);
    }
  );

  it("should deal the back damage when the victim looks away from the attacker", () => {
    const sim = createSim("cannonball", [100, 150]);
    sim.players[1]!.facing = 1;
    sim.step([RIGHT]);
    sim.step([], 60);
    expect(sim.hits).toHaveLength(1);
    expect(sim.hits[0]).toMatchObject({ zone: "back", damage: T.dive.backHitDamage });
  });

  it("should reflect both divers equally and hit both when two cannonballs meet head-on", () => {
    const sim = createSim("cannonball", [100, 300]);
    const [a, b] = sim.players as [PlayerState, PlayerState];
    sim.step([RIGHT, { fire: true, aimX: -1 }]);
    while (sim.hits.length === 0) sim.step();
    expect(sim.hits).toHaveLength(2);
    expect(sim.hits.map((hit) => hit.zone)).toEqual(["front", "front"]);
    expect(a.vx).toBeLessThan(0);
    expect(a.vx).toBeCloseTo(-b.vx);
    expect(a.vy).toBeCloseTo(b.vy);
    expect(a.x - 100).toBeCloseTo(300 - b.x);
  });

  it("should count a slow touch as a bump, not a hit, when the diver is barely moving", () => {
    const sim = createSim("snap", [100, 128]);
    sim.step([{ moveX: 1 }], 60);
    expect(sim.hits).toHaveLength(0);
  });

  it("should not hit when a blob runs into a diver from behind", () => {
    const sim = createSim("cannonball", [200, 100]);
    const [diver, runner] = sim.players as [PlayerState, PlayerState];
    sim.step([RIGHT]);
    runner.x = diver.x - 20;
    runner.vx = 300;
    sim.step([], 3);
    expect(sim.hits).toHaveLength(0);
  });

  it("should let the pogo dive again at once when it lands a hit", () => {
    const sim = createSim("pogo", [100, 150]);
    const attacker = sim.players[0]!;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(attacker.vy).toBeLessThan(0);
    sim.step([RIGHT]);
    expect(sim.phaseOf(attacker)).toBe("windup");
  });

  it("should stagger the victim's steering when it is hit", () => {
    const sim = createSim("cannonball", [100, 150]);
    const victim = sim.players[1]!;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(victim.steerScale).toBe(T.dive.staggerSteerScale);
    sim.step([], frames(T.dive.staggerSeconds) + 1);
    expect(victim.steerScale).toBe(1);
  });
});
