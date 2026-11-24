import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { directHitPush } from "@/shared/utils/blastPower";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import {
  createPlayer,
  resolveBodyContacts,
  rollLockFor,
  stepPlayers,
  type PlayerState,
} from "@/features/player/api/playerApi";
import { createCombatState, stepCombat } from "@/features/combat/api/combatApi";
import {
  createDiveState,
  isDiveSpent,
  refillDive,
  requestDive,
  resetDive,
  stepDives,
} from "@/features/dive/services/diveSim";
import { resolveReachContacts } from "@/features/dive/services/diveReach";
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
      hits.push(
        ...stepDives({ dive, players, combat, contacts, inputs, tunables, timeSeconds, dt })
      );
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

  it("should wait for the cooldown before the next dive when the blob is airborne with its charge", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    // Off the ground with the charge (walked off a ledge): the cooldown still counts.
    liftTo(player, 100);
    player.coyoteTimer = 0;
    player.vy = 0;
    sim.step([RIGHT]);
    expect(sim.phaseOf(player)).toBe("idle");
    expect(sim.dive.deniedCounts[player.id]).toBe(1);
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
    // A shove of a couple of blob widths (dive-push lap: the victim keeps `hitPushScale` of it).
    expect(victim.x).toBeGreaterThan(150 + 2 * T.player.width);
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

  it("should push the victim away like a direct rocket hit and stagger its steering when it is hit", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    // Level with the attacker: straight along the hit, as fast as a rocket exploding on it.
    expect(victim.vx).toBeCloseTo(directHitPush(T), 0);
    expect(victim.vy).toBeCloseTo(0, 0);
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
  it("should roll the victim as long as the hit's impulse says and block its dive", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    victim.facing = -1;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    expect(victim.rollSource).toBe("hit");
    const impulse = sim.hits[0]!.impulse;
    expect(victim.rollLockSeconds).toBeCloseTo(rollLockFor(impulse, T.roll), 5);
    sim.step([{}, { fire: true, aimX: -1 }], 2);
    expect(sim.phaseOf(victim)).toBe("idle");
  });

  it("should never bounce the attacker off terrain when it misses and lets go of fire", () => {
    const sim = createSim([520]);
    sim.step([RIGHT]);
    sim.step([], 200);
    expect(sim.players[0]!.rollBounceCount).toBe(0);
  });
});

describe("stepDives dash-hold roll", () => {
  it("should roll on at full dive speed when fire is held through the travel", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT], frames(D.windupSeconds + D.travelSeconds) + 2);
    expect(player.rollSource).toBe("dash");
    expect(sim.phaseOf(player)).toBe("idle");
    expect(player.vx).toBeGreaterThan(D.launchSpeed * D.exitSpeedScale);
    expect(player.moveRollCount).toBe(1);
  });

  it("should recover as before when fire is let go before the travel ends", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim);
    stepsUntilPhaseChange(sim);
    expect(sim.phaseOf(player)).toBe("recovery");
    expect(player.rollSource).toBeNull();
  });

  it("should stop the dash roll when fire is released", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT], frames(D.windupSeconds + D.travelSeconds) + 2);
    expect(player.rollSource).toBe("dash");
    sim.step([], 1);
    expect(player.rollSource).toBeNull();
  });
});

describe("refillDive (headbutt reset)", () => {
  /** Dives right from high in the air, then runs until the dive is back to idle. */
  const diveInAir = (refillMidDive: boolean) => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 40);
    sim.step([RIGHT]);
    stepsUntilPhaseChange(sim); // wind-up → travel
    if (refillMidDive) refillDive(sim.dive, player);
    stepsUntilPhaseChange(sim); // travel → recovery
    stepsUntilPhaseChange(sim); // recovery → idle
    sim.step([RIGHT]);
    return { sim, player };
  };

  it("should count the dive as spent when the player is airborne after a dive", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    expect(isDiveSpent(sim.dive, player)).toBe(false);
    liftTo(player, 40);
    sim.step([RIGHT]);
    expect(isDiveSpent(sim.dive, player)).toBe(true);
  });

  it("should not count a wind-up on the ground as spent when the player is standing", () => {
    const sim = createSim([100]);
    sim.step([RIGHT]);
    expect(isDiveSpent(sim.dive, sim.players[0]!)).toBe(false);
  });

  it("should let the next dive start right after the recovery when the charge was refilled mid-dive", () => {
    const { sim, player } = diveInAir(true);
    expect(sim.phaseOf(player)).toBe("windup");
    expect(sim.dive.refillCounts[player.id]).toBe(1);
  });

  it("should refuse a second dive in the same airtime when no refill was taken", () => {
    const { sim, player } = diveInAir(false);
    expect(sim.phaseOf(player)).toBe("idle");
  });

  it("should keep the refill count when the player respawns", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    refillDive(sim.dive, player);
    resetDive(sim.dive, player);
    expect(sim.dive.refillCounts[player.id]).toBe(1);
  });
});

describe("dash press reliability (dash-feel lap)", () => {
  /** Dashes right along the floor and steps until that dash is in `phase`. */
  const dashUntil = (sim: ReturnType<typeof createSim>, phase: DivePhase) => {
    sim.step([RIGHT]);
    sim.step();
    while (sim.phaseOf(sim.players[0]!) !== phase) sim.step();
  };

  it("should start the next dash at once when the blob stands on the ground after a dash", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    dashUntil(sim, "idle");
    expect(player.grounded).toBe(true);
    sim.step([RIGHT]);
    expect(sim.phaseOf(player)).toBe("windup");
  });

  it("should cut the recovery short and dash when fire is pressed on the ground during it", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    dashUntil(sim, "recovery");
    sim.step([RIGHT]);
    sim.step();
    expect(sim.phaseOf(player)).toBe("windup");
    expect(sim.dive.deniedCounts[player.id] ?? 0).toBe(0);
  });

  it("should chain the next dash when fire is pressed again just before a ground dash ends", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    sim.step();
    while (sim.phaseOf(player) !== "travel") sim.step();
    sim.step([], frames(D.travelSeconds) - frames(0.1));
    sim.step([RIGHT]);
    let steps = 0;
    while (sim.phaseOf(player) !== "windup" && steps < frames(D.fireBufferSeconds)) {
      sim.step();
      steps += 1;
    }
    expect(sim.phaseOf(player)).toBe("windup");
    expect(sim.dive.deniedCounts[player.id] ?? 0).toBe(0);
  });

  it("should deny at once when fire is pressed early in a dash", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.step([RIGHT]);
    sim.step();
    sim.step([RIGHT]);
    expect(sim.dive.deniedCounts[player.id]).toBe(1);
  });

  it("should dash on touchdown when fire was pressed just before landing with the dive spent", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 40);
    sim.step([{ fire: true, aimY: -1 }]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    expect(isDiveSpent(sim.dive, player)).toBe(true);
    // Fall until about 60 ms before touchdown, then press.
    while (player.y + player.vy * 0.06 < FLOOR_Y) sim.step();
    sim.step([RIGHT]);
    let steps = 0;
    while (sim.phaseOf(player) === "idle" && steps < frames(D.fireBufferSeconds) + 1) {
      sim.step();
      steps += 1;
    }
    expect(sim.phaseOf(player)).toBe("windup");
    expect(sim.dive.deniedCounts[player.id] ?? 0).toBe(0);
  });

  it("should deny the press once when the buffer runs out in the air with the dive spent", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 20);
    sim.step([{ fire: true, aimY: -1 }]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    sim.step([RIGHT]);
    sim.step([], frames(D.fireBufferSeconds) + 2);
    expect(player.grounded).toBe(false);
    expect(sim.phaseOf(player)).toBe("idle");
    expect(sim.dive.deniedCounts[player.id]).toBe(1);
    expect(sim.dive.motions[player.id]!.sinceDenied).toBeLessThan(0.05);
  });

  it("should deny a mid-air jump press when the dive is spent", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    liftTo(player, 20);
    sim.step([{ fire: true, aimY: -1 }]);
    while (sim.phaseOf(player) !== "idle") sim.step();
    sim.step([{ jump: true }]);
    sim.step();
    expect(sim.dive.deniedCounts[player.id]).toBe(1);
  });

  it("should deny at once and not dash later when pressed early in a hit stagger", () => {
    const sim = createSim([100, 150]);
    const victim = sim.players[1]!;
    victim.facing = -1;
    sim.step([RIGHT]);
    while (sim.hits.length === 0) sim.step();
    sim.step([{}, { fire: true, aimX: -1 }]);
    expect(sim.dive.deniedCounts[victim.id]).toBe(1);
    sim.step([], frames(D.staggerSeconds));
    expect(sim.phaseOf(victim)).toBe("idle");
  });

  it("should never deny a press that starts a dash", () => {
    const sim = createSim([100]);
    sim.step([RIGHT]);
    expect(sim.dive.deniedCounts[sim.players[0]!.id] ?? 0).toBe(0);
  });

  it("should dash unarmed right after the last rocket when the launcher ran empty", () => {
    const sim = createSim([100]);
    const player = sim.players[0]!;
    sim.combat.fighters.get(player.id)!.weapon = { itemId: "rocket-launcher", ammo: 1 };
    sim.step([RIGHT]);
    expect(sim.combat.fighters.get(player.id)!.weapon).toBeNull();
    sim.step();
    sim.step([RIGHT]);
    expect(sim.phaseOf(player)).toBe("windup");
  });
});

describe("dash aim magnetism (dash-aim lap, owner pick B)", () => {
  /** The dash with option B (magnet) and option A (hit reach) set as given. */
  const withAim = (magnet: boolean, hitReach: number): GameTunables => ({
    ...T,
    dive: { ...D, hitReach, magnet: { ...D.magnet, enabled: magnet } },
  });
  /** The dash before any aim assist: no magnet, touch-only reach (the body width). */
  const NO_MAGNET = withAim(false, T.player.width);

  interface DashCase {
    /** Target (standing on the floor) offset from the dasher, feet to feet; y is down. */
    offset: { x: number; y: number };
    aim: InputPatch;
    /** Target velocity given at the press (a jump). */
    launch?: { vx: number; vy: number };
  }

  /** Dashes at the target (the dasher hangs `offset.y` above the floor) and reports a landed hit. */
  const dashAt = (c: DashCase, tunables: GameTunables = T): boolean => {
    const sim = createSim([100, 100 + c.offset.x], tunables);
    const [dasher, target] = [sim.players[0]!, sim.players[1]!];
    if (c.offset.y > 0) Object.assign(dasher, { y: FLOOR_Y - c.offset.y, vy: 0, grounded: false });
    if (c.launch) Object.assign(target, { ...c.launch, y: FLOOR_Y - 1, grounded: false });
    sim.step([{ fire: true, ...c.aim }]);
    sim.step([c.aim], frames(D.windupSeconds + D.travelSeconds) + 2);
    return sim.hits.some((hit) => hit.attackerSlot === 0);
  };

  const aimAt = (x: number, y: number): InputPatch => {
    const length = Math.hypot(x, y);
    return { aimX: x / length, aimY: y / length };
  };

  it("should land on a target between two of the 16 directions when the stick aims right at it", () => {
    const offAngle: DashCase = { offset: { x: 149, y: 101 }, aim: aimAt(149, 101) };
    expect(dashAt(offAngle, NO_MAGNET)).toBe(false);
    expect(dashAt(offAngle)).toBe(true);
  });

  it("should land on a target that jumps as the dash starts when the stick aims at where it stood", () => {
    const jumper: DashCase = {
      offset: { x: 145, y: 0 },
      aim: { aimX: 1 },
      launch: { vx: 0, vy: -380 },
    };
    expect(dashAt(jumper, NO_MAGNET)).toBe(false);
    expect(dashAt(jumper)).toBe(true);
  });

  it("should land with keyboard aim (8 ways) on a target 12° off the straight line", () => {
    const keyboard: DashCase = { offset: { x: 176, y: 37 }, aim: { aimX: 1 } };
    expect(dashAt(keyboard, NO_MAGNET)).toBe(false);
    expect(dashAt(keyboard)).toBe(true);
  });

  const DEMO_CASES: DashCase[] = [
    { offset: { x: 149, y: 101 }, aim: aimAt(149, 101) },
    { offset: { x: 145, y: 0 }, aim: { aimX: 1 }, launch: { vx: 0, vy: -380 } },
    { offset: { x: 176, y: 37 }, aim: { aimX: 1 } },
  ];

  it("should ship the magnet and the 48-unit dive reach together (A+B, dive-reach lap)", () => {
    expect(D.magnet.enabled).toBe(true);
    expect(D.hitReach).toBe(48);
    expect(DEMO_CASES.map((c) => dashAt(c))).toEqual([true, true, true]);
  });

  it("should land all three demo cases when the magnet and a 48-unit hit reach are both on (A+B)", () => {
    expect(DEMO_CASES.map((c) => dashAt(c, withAim(true, 48)))).toEqual([true, true, true]);
  });

  it("should land only the keyboard near miss with a 48-unit hit reach alone (A only)", () => {
    // The off-angle dash snaps to 45° down and meets the floor 48 units short of the target; the
    // jumper is well above the dash line by the time it passes.
    expect(DEMO_CASES.map((c) => dashAt(c, withAim(false, 48)))).toEqual([false, false, true]);
  });

  it("should not strike from a distance when the reach is the body width", () => {
    const sim = createSim([100, 100 + 176], withAim(false, T.player.width));
    sim.step([{ fire: true, aimX: 1 }]);
    const target = sim.players[1]!;
    for (let i = 0; i < frames(D.windupSeconds + D.travelSeconds); i += 1) {
      Object.assign(target, { y: FLOOR_Y - 37, vx: 0, vy: 0 });
      sim.step([{ aimX: 1 }]);
    }
    expect(sim.hits).toHaveLength(0);
  });

  it("should keep the snapped direction when the target is outside the cone", () => {
    const sim = createSim([100, 230]);
    const target = sim.players[1]!;
    const pin = () => Object.assign(target, { y: FLOOR_Y - 75, vx: 0, vy: 0, grounded: false });
    pin();
    sim.step([{ fire: true, aimX: 1 }]);
    while (sim.phaseOf(sim.players[0]!) !== "travel") {
      pin();
      sim.step([{ aimX: 1 }]);
    }
    expect(sim.players[0]!.vy).toBe(0);
  });

  it("should keep the snapped direction when the target is out of range", () => {
    const sim = createSim([100, 100 + D.magnet.range + 40]);
    const target = sim.players[1]!;
    const pin = () => Object.assign(target, { y: FLOOR_Y - 30, vx: 0, vy: 0, grounded: false });
    pin();
    sim.step([{ fire: true, aimX: 1 }]);
    while (sim.phaseOf(sim.players[0]!) !== "travel") {
      pin();
      sim.step([{ aimX: 1 }]);
    }
    expect(sim.players[0]!.vy).toBe(0);
  });
});

describe("dive hit damage and reach (dive-reach-and-double-hit lap)", () => {
  const MAX = T.combat.maxHealth;

  /** One dash at a standing victim 100 units right; steps a full second after the press. */
  const dashOnce = (victimFacing: -1 | 1) => {
    const sim = createSim([100, 200]);
    const victim = sim.players[1]!;
    victim.facing = victimFacing;
    sim.step([{ fire: true, aimX: 1 }]);
    for (let i = 0; i < HZ; i += 1) {
      victim.facing = victimFacing;
      sim.step([{ aimX: 1 }]);
    }
    return { hits: sim.hits, health: sim.healthOf(victim) };
  };

  it("should take exactly one front chunk once when a dive hits a victim facing the attacker", () => {
    const { hits, health } = dashOnce(-1);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.zone).toBe("front");
    expect(health).toBe(MAX - CONTACT.front);
  });

  it("should take exactly one heart once when the victim faces away (owner: a bash is always 1 heart)", () => {
    const { hits, health } = dashOnce(1);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.zone).toBe("back");
    expect(hits[0]!.damage).toBe(1);
    expect(health).toBe(MAX - 1);
  });

  it("should never hit twice in one dive when the dive passes inside the reach and then touches", () => {
    const sim = createSim([100, 200]);
    sim.players[1]!.facing = -1;
    sim.step([{ fire: true, aimX: 1 }]);
    while (sim.phaseOf(sim.players[0]!) !== "idle" || sim.hits.length === 0)
      sim.step([{ aimX: 1 }]);
    sim.step([{ aimX: 1 }], HZ);
    expect(sim.hits).toHaveLength(1);
  });

  /** A dash along the floor past a blob held `above` units over the dash line; magnet off. */
  const nearPass = (above: number, hitReach: number): number => {
    const sim = createSim([100, 220], {
      ...T,
      dive: { ...D, hitReach, magnet: { ...D.magnet, enabled: false } },
    });
    const target = sim.players[1]!;
    const hold = () => Object.assign(target, { y: FLOOR_Y - above, vx: 0, vy: 0 });
    hold();
    sim.step([{ fire: true, aimX: 1 }]);
    for (let i = 0; i < frames(D.windupSeconds + D.travelSeconds); i += 1) {
      hold();
      sim.step([{ aimX: 1 }]);
    }
    return sim.hits.length;
  };

  it("should land a near pass 40 units off the dash line that the touch-only reach missed", () => {
    expect(nearPass(40, T.player.width)).toBe(0);
    expect(nearPass(40, D.hitReach)).toBe(1);
  });

  it("should leave a bump without a dive harmless at any distance inside the dive reach", () => {
    const sim = createSim([100, 140]);
    sim.step([{ moveX: 1 }, { moveX: -1 }], HZ);
    expect(sim.hits).toHaveLength(0);
    expect(sim.healthOf(sim.players[1]!)).toBe(MAX);
    expect(
      resolveReachContacts({ dive: sim.dive, players: sim.players, contacts: [], tunables: T })
    ).toHaveLength(0);
  });

  it("should shove nobody when a dive passes inside the reach while moving away", () => {
    const sim = createSim([100, 140]);
    const [dasher, other] = sim.players as [PlayerState, PlayerState];
    sim.dive.motions[dasher.id] = { ...sim.dive.motions[dasher.id]!, phase: "travel" };
    Object.assign(dasher, { vx: -D.launchSpeed, vy: 0 });
    Object.assign(other, { vx: 0, vy: 0 });
    const args = { dive: sim.dive, players: sim.players, contacts: [], tunables: T };
    expect(resolveReachContacts(args)).toHaveLength(0);
    expect([dasher.vx, other.vx]).toEqual([-D.launchSpeed, 0]);
  });
});
