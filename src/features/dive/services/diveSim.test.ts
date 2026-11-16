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
import { createCombatState, stepCombat } from "@/features/combat/api/combatApi";
import { createDiveState, requestDive, stepDives } from "@/features/dive/services/diveSim";
import type { DiveHit, DivePhase } from "@/features/dive/types/dive.types";

// Cell size 8. Floor top y = 320. Thin wall (one cell) x 600–608, y 0–320. Open sky elsewhere.
const stone = (rect: Rect) => ({
  shape: { type: "rect" as const, ...rect },

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
const D = T.dive;
const CONTACT = T.combat.hitDamage.contact;
const frames = (seconds: number): number => Math.round(seconds * HZ);

type InputPatch = Partial<PlayerInput>;

/** The match's steps 2, 2b, 3 and 3b on a small world; players start standing on the floor. */
const createSim = (starts: number[], tunables: GameTunables = T) => {
  const terrain = buildTerrainFromLevel(level);
  const players = starts.map((x, slot) => createPlayer(slot, { x, y: FLOOR_Y }, tunables));
  const dive = createDiveState();
  const combat = createCombatState();
  const hits: DiveHit[] = [];
  let timeSeconds = 0;
  const step = (patches: InputPatch[] = [], steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = players.map((_, slot) => ({
        ...EMPTY_PLAYER_INPUT,
        connected: true,
        ...patches[slot],
      }));
      stepPlayers({ players, inputs, terrain, tunables, dt });
      const contacts = resolveBodyContacts({ players, terrain, tunables });
      stepCombat({
        combat,
        players,
        inputs,
        terrain,
        bounds: level.bounds,
        tunables,
        timeSeconds,
        dt,
        unarmedAttack: ({ attacker }) => requestDive(dive, attacker, tunables),
      });
      hits.push(...stepDives({ dive, players, combat, contacts, tunables, timeSeconds, dt }));
      timeSeconds += dt;
    }
  };
  step(); // settle on the floor (grounded, dive charged)
  const phaseOf = (player: PlayerState): DivePhase => dive.motions[player.id]!.phase;
  const healthOf = (player: PlayerState): number => combat.fighters.get(player.id)!.health;
  return { players, dive, combat, hits, step, phaseOf, healthOf, time: () => timeSeconds };
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
/** Lifts a settled player into open air. */
const liftTo = (player: PlayerState, y: number): void => {
  player.y = y;
  player.grounded = false;
};

describe("stepDives timeline", () => {
  it("should run wind-up, travel and recovery for the tuned number of steps when fire is pressed", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    expect(sim.phaseOf(player)).toBe("windup");
    expect(stepsUntilPhaseChange(sim)).toBe(frames(D.windupSeconds));
    expect(sim.phaseOf(player)).toBe("travel");
    expect(player.vx).toBeCloseTo(D.launchSpeed);
    expect(player.vy).toBe(0);
    expect(stepsUntilPhaseChange(sim)).toBe(frames(D.travelSeconds));
    expect(sim.phaseOf(player)).toBe("recovery");
    expect(stepsUntilPhaseChange(sim)).toBe(frames(D.recoverySeconds));
    expect(sim.phaseOf(player)).toBe("idle");
  });

  it("should fly dead straight for launchSpeed × travelSeconds with no gravity when nothing is in the way", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 150);
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    const start = { x: player.x, y: player.y };
    stepsUntilPhaseChange(sim);
    expect(player.x - start.x).toBeCloseTo(D.launchSpeed * D.travelSeconds, 0);
    expect(player.y).toBeCloseTo(start.y);
  });

  it("should hang in the air during the wind-up when the dive starts while falling", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 100);
    player.vy = 400;
    sim.step([RIGHT]);
    const y = player.y;
    sim.step([], frames(D.windupSeconds) - 1);
    expect(player.y - y).toBeLessThan(400 * D.windupSpeedScale * D.windupSeconds + 1);
  });

  it("should snap the dive to the nearest of 16 directions (22.5° steps) when the aim is analog", () => {
    // [aim, expected dive angle]: −16.7° → −22.5°, −5.7° → 0°, −60° → −67.5° (y is down).
    const cases: [InputPatch, number][] = [
      [{ aimX: 1, aimY: -0.3 }, -Math.PI / 8],
      [{ aimX: 1, aimY: -0.1 }, 0],
      [{ aimX: 0.5, aimY: -Math.sqrt(3) / 2 }, (-3 * Math.PI) / 8],
    ];
    for (const [aim, angle] of cases) {
      const sim = createSim([100]);
      const player = sim.players[0]!;
      liftTo(player, 150);
      sim.step([{ fire: true, ...aim }]);
      stepsUntilPhaseChange(sim);
      expect(player.vx).toBeCloseTo(Math.cos(angle) * D.launchSpeed);
      expect(player.vy).toBeCloseTo(Math.sin(angle) * D.launchSpeed);
    }
  });

  it("should ignore steering and jump while the dive travels", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    sim.step([{ moveX: -1, jump: true }], 10);
    expect(sim.phaseOf(player)).toBe("travel");
    expect(player.vx).toBeCloseTo(D.launchSpeed);
    expect(player.y).toBe(FLOOR_Y);
  });

  it("should not start a dive again when fire stays held", () => {
    const sim = createSim([100]);
    sim.step([RIGHT], 300);
    expect(sim.phaseOf(sim.players[0]!)).toBe("idle");
  });

  it("should wait for the cooldown before the next dive when fire is pressed again at once", () => {
    const sim = createSim([100]);
    sim.step([RIGHT]);
    while (sim.phaseOf(sim.players[0]!) !== "idle") sim.step();
    sim.step([RIGHT]);
    expect(sim.phaseOf(sim.players[0]!)).toBe("idle");
    sim.step([], frames(D.cooldownSeconds));
    sim.step([RIGHT]);
    expect(sim.phaseOf(sim.players[0]!)).toBe("windup");
  });

  it("should allow only one dive per airtime when diving upward", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 60);
    const UP: InputPatch = { fire: true, aimY: -1 };
    sim.step([UP]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    sim.step([], frames(D.cooldownSeconds) + 1);
    expect(player.grounded).toBe(false);
    sim.step([UP]);
    sim.step();
    expect(sim.phaseOf(player)).toBe("idle");
    while (!player.grounded) sim.step();
    sim.step([UP]);
    expect(sim.phaseOf(player)).toBe("windup");
  });

  it("should hand steering and gravity back to the controller when the dive is over", () => {
    const sim = createSim([100]);
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
  it("should not tunnel through a one-cell wall when diving into it", () => {
    const sim = createSim([520]);
    sim.step([RIGHT]);
    sim.step([], 200);
    expect(sim.players[0]!.x + sim.players[0]!.width / 2).toBeLessThanOrEqual(600);
  });

  it("should not tunnel through a one-cell wall when the launch speed is far above the tuned one", () => {
    const fast: GameTunables = { ...T, dive: { ...D, launchSpeed: 6000 } };
    const sim = createSim([300], fast);
    sim.step([RIGHT]);
    sim.step([], 200);
    expect(sim.players[0]!.x + sim.players[0]!.width / 2).toBeLessThanOrEqual(600);
  });

  it("should stun the diver briefly and throw it back when it hits a wall head-on", () => {
    const sim = createSim([520]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    stepsUntilPhaseChange(sim);
    expect(sim.phaseOf(player)).toBe("recovery");
    expect(sim.dive.motions[player.id]!.bonked).toBe(true);
    expect(player.vx).toBeCloseTo(-D.launchSpeed * D.bonkRebound);
    expect(stepsUntilPhaseChange(sim)).toBe(frames(D.bonkStunSeconds));
  });

  it("should end the dive without a bounce when it dives straight down onto the floor", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 200);
    sim.step([{ fire: true, aimY: 1 }]);
    stepsUntilPhaseChange(sim);
    stepsUntilPhaseChange(sim);
    expect(sim.phaseOf(player)).toBe("recovery");
    // The bonk rebound is a small hop, far below the dive speed: no ricochet off terrain.
    expect(Math.abs(player.vy)).toBeLessThanOrEqual(D.launchSpeed * D.bonkRebound + 1);
    sim.step([], 40);
    expect(player.y).toBeGreaterThan(FLOOR_Y - 20);
  });

  it("should end the dive and keep sliding along the floor when it hits the floor at an angle", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 280);
    sim.step([{ fire: true, aimX: 1, aimY: 1 }]);
    stepsUntilPhaseChange(sim);
    stepsUntilPhaseChange(sim);
    expect(sim.phaseOf(player)).toBe("recovery");
    expect(sim.dive.motions[player.id]!.bonked).toBe(false);
    expect(player.vx).toBeGreaterThan(0);
    expect(player.vy).toBeGreaterThanOrEqual(0);
    expect(player.y).toBe(FLOOR_Y);
  });
});

describe("stepDives hits", () => {
  it("should land exactly one front hit and send the victim away when diving at a blob that faces the attacker", () => {
    const sim = createSim([100, 150]);
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
      landed: true,
      zone: "front",
      damage: CONTACT.front,
    });
    expect(sim.healthOf(victim)).toBe(T.combat.maxHealth - CONTACT.front);
    expect(sim.healthOf(attacker)).toBe(T.combat.maxHealth);
    expect(sim.hits[0]!.impulse.x).toBeGreaterThan(0);
    expect(victim.x).toBeGreaterThan(150 + 100);
  });

  it("should deal the back damage when the victim looks away from the attacker", () => {
    const sim = createSim([100, 150]);
    sim.players[1]!.facing = 1;
    sim.step([RIGHT]);
    sim.step([], 60);
    expect(sim.hits).toHaveLength(1);
    expect(sim.hits[0]).toMatchObject({ zone: "back", damage: CONTACT.back });
    expect(sim.healthOf(sim.players[1]!)).toBe(T.combat.maxHealth - CONTACT.back);
  });

  it("should ricochet the attacker upward with its dive ready again when it lands a hit", () => {
    const sim = createSim([100, 150]);
    const attacker = sim.players[0]!;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(attacker.vy).toBeCloseTo(-D.attackerPop);
    expect(sim.phaseOf(attacker)).toBe("idle");
    sim.step([], 2);
    expect(attacker.grounded).toBe(false);
    sim.step([RIGHT]);
    expect(sim.phaseOf(attacker)).toBe("windup");
  });

  it("should pop the victim up and stagger its steering when it is hit", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(victim.vy).toBeLessThanOrEqual(-D.strikeLift + 1);
    expect(victim.steerScale).toBe(D.staggerSteerScale);
    sim.step([], frames(D.staggerSeconds) + 1);
    expect(victim.steerScale).toBe(1);
  });

  it("should reflect both divers equally and hit both when two dives meet head-on", () => {
    const sim = createSim([100, 300]);
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

  it("should count a slow touch as a bump, not a hit, when nobody is diving", () => {
    const sim = createSim([100, 128]);
    sim.step([{ moveX: 1 }], 60);
    expect(sim.hits).toHaveLength(0);
  });

  it("should not hit when a blob runs into a diver from behind", () => {
    const sim = createSim([200, 100]);
    const [diver, runner] = sim.players as [PlayerState, PlayerState];
    sim.step([RIGHT]);
    runner.x = diver.x - 20;
    runner.vx = 300;
    sim.step([], 3);
    expect(sim.hits).toHaveLength(0);
  });

  it("should cancel the victim's own dive when it is hit during its wind-up", () => {
    const sim = createSim([100, 250]);
    const victim = sim.players[1]!;
    sim.step([RIGHT]);
    sim.step([], frames(D.windupSeconds) + 6);
    sim.step([{}, { fire: true, aimX: 1 }]);
    expect(sim.phaseOf(victim)).toBe("windup");
    while (sim.hits.length === 0) sim.step();
    expect(sim.hits).toHaveLength(1);
    expect(sim.phaseOf(victim)).toBe("recovery");
  });
});

describe("stepDives and combat", () => {
  it("should still bounce a spawn-protected victim but take no health when the dive hits it", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    sim.combat.fighters.get(victim.id)!.invulnerableUntil = sim.time() + 10;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(sim.hits[0]).toMatchObject({ landed: false, damage: 0 });
    expect(sim.healthOf(victim)).toBe(T.combat.maxHealth);
    expect(victim.vx).toBeGreaterThan(0);
  });

  it("should shoot a rocket instead of diving when the player holds a launcher", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.combat.fighters.get(player.id)!.weapon = { itemId: "rocket-launcher", ammo: 3 };
    sim.step([RIGHT]);
    expect(sim.phaseOf(player)).toBe("idle");
    expect(sim.combat.rockets).toHaveLength(1);
  });

  it("should emit combat's playerHit event with the dive as source when a dive lands", () => {
    const sim = createSim([100, 150]);
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    const event = sim.combat.events.find((entry) => entry.type === "playerHit");
    expect(event).toMatchObject({
      source: "dive",
      kind: "contact",
      victimSlot: 1,
      byPlayerSlot: 0,
    });
  });
});

describe("stepDives hurt reaction", () => {
  it("should send the victim tumbling off the floor and block its dive when the hit is hard", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    victim.facing = -1;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(Math.hypot(sim.hits[0]!.impulse.x, sim.hits[0]!.impulse.y)).toBeGreaterThanOrEqual(
      T.tumble.minImpulse
    );
    expect(victim.tumbleSeconds).toBeGreaterThan(0);
    sim.step([{}, { fire: true, aimX: -1 }], 2);
    expect(sim.phaseOf(victim)).toBe("idle");
    while (victim.tumbleBounceCount === 0 && victim.tumbleSeconds > 0) sim.step();
    expect(victim.tumbleBounceCount).toBe(1);
    expect(victim.vy).toBeLessThan(0);
  });

  it("should keep the plain knockback when a front hit is light", () => {
    const soft: GameTunables = { ...T, tumble: { ...T.tumble, minImpulse: 5000 } };
    const sim = createSim([100, 150], soft);
    const victim = sim.players[1]!;
    victim.facing = -1;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(victim.tumbleSeconds).toBe(0);
    expect(victim.steerScale).toBe(D.staggerSteerScale);
  });

  it("should send the victim tumbling on any back hit", () => {
    const soft: GameTunables = { ...T, tumble: { ...T.tumble, minImpulse: 5000 } };
    const sim = createSim([100, 150], soft);
    const victim = sim.players[1]!;
    victim.facing = 1;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(sim.hits[0]!.zone).toBe("back");
    expect(victim.tumbleSeconds).toBeGreaterThan(0);
  });

  it("should never bounce the attacker off terrain when it misses", () => {
    const sim = createSim([520]);
    sim.step([RIGHT], 200);
    expect(sim.players[0]!.tumbleBounceCount).toBe(0);
  });
});
