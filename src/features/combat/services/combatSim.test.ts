import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { buildTerrainFromLevel, getCellInfo } from "@/features/arena/api/arenaApi";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers, type PlayerState } from "@/features/player/api/playerApi";
import { stepCombat } from "@/features/combat/services/combatSim";
import {
  applyHit,
  createCombatState,
  eliminateFighter,
  fighterFor,
  type CombatContext,
} from "@/features/combat/services/combatState";
import { explode, type Blast } from "@/features/combat/services/explosions";
import { stepAttacks } from "@/features/combat/services/attacks";
import { takeWeaponPickups } from "@/features/combat/services/weapons";
import type { CombatEvent, CombatState } from "@/features/combat/types/combat.types";

// Cell size 8. Stone floor top y = 320 (x 0–1200). Thin stone wall x 800–808 (y 0–320).
// Dirt plateau x 400–560, y 160–184 resting on nothing (stone strip under it at y 184–192).
const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "combat", title: "Combat" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 1200, h: 400 },
  terrain: [
    {
      shape: { type: "rect", x: 0, y: 320, w: 1200, h: 32 },

      materialId: "stone",
    },
    { shape: { type: "rect", x: 800, y: 0, w: 8, h: 320 }, materialId: "stone" },
    {
      shape: { type: "rect", x: 400, y: 160, w: 160, h: 24 },

      materialId: "earth",
    },
    {
      shape: { type: "rect", x: 400, y: 184, w: 160, h: 8 },

      materialId: "stone",
    },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: -400, w: 1200, h: 800 },
};

const FLOOR_Y = 320;
const dt = 1 / 120;
const C = DEFAULT_GAME_TUNABLES.combat;
const ROCKET_POWER = C.rocket.power;
/** A rocket-power blast fired by player 0 at `at`. */
const p0Blast = (at: Blast["at"]): Blast => ({
  at,
  ownerSlot: 0,
  ownerId: "p0",
  power: ROCKET_POWER,
  craterShape: C.rocket.craterShape,
});
const P = DEFAULT_GAME_TUNABLES.player;
const G = DEFAULT_GAME_TUNABLES.world.gravity;

type InputPatch = Partial<PlayerInput>;

interface World {
  players: PlayerState[];
  combat: CombatState;
  ctx: () => CombatContext;
  /** Steps the players and combat; `inputs[i]` patches player i's input. */
  step: (inputs?: InputPatch[], steps?: number) => void;
  /** Every event seen since the world was created (the live log is pruned). */
  seen: CombatEvent[];
  time: () => number;
}

interface WorldOptions {
  at: { x: number; y: number }[];
  tunables?: GameTunables;
}

function createWorld({ at, tunables = DEFAULT_GAME_TUNABLES }: WorldOptions): World {
  const terrain = buildTerrainFromLevel(level);
  const players = at.map((point, slot) => createPlayer(slot, point, tunables));
  const combat = createCombatState();
  const seen: CombatEvent[] = [];
  let time = 0;
  let lastSeq = 0;
  const ctx = (): CombatContext => ({
    combat,
    players,
    terrain,
    bounds: level.bounds,
    tunables,
    timeSeconds: time,
  });
  const step = (patches: InputPatch[] = [], steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = players.map((_, slot) => ({
        ...EMPTY_PLAYER_INPUT,
        connected: true,
        ...patches[slot],
      }));
      stepPlayers({ players, inputs, terrain, tunables, dt });
      stepCombat({
        combat,
        players,
        inputs,
        terrain,
        bounds: level.bounds,
        tunables,
        timeSeconds: time,
        dt,
      });
      for (const event of combat.events) if (event.seq > lastSeq) seen.push(event);
      lastSeq = combat.nextSeq - 1;
      time += dt;
    }
  };
  step([], 60); // settle on the floor
  for (const player of players) fighterFor(combat, player, tunables);
  return { players, combat, ctx, step, seen, time: () => time };
}

const arm = (world: World, slot: number, itemId: WeaponItemId = "rocket-launcher"): void => {
  const fighter = world.combat.fighters.get(`p${slot}`)!;
  fighter.weapon = { itemId, ammo: C.rocket.ammo };
};

const health = (world: World, slot: number): number =>
  world.combat.fighters.get(`p${slot}`)!.health;

const eventsOf = <T extends CombatEvent["type"]>(world: World, type: T) =>
  world.seen.filter((event): event is Extract<CombatEvent, { type: T }> => event.type === type);

/** Player 0 presses fire for one step (aiming), then holds the aim for `after` steps. */
const shoot = (world: World, aim: InputPatch, after = 120): void => {
  world.step([{ ...aim, fire: true }]);
  world.step([aim], after);
};

describe("combat — rockets and explosions", () => {
  it("should remove exactly one chunk from the target and none from the shooter when a rocket hits", () => {
    const world = createWorld({
      at: [
        { x: 200, y: FLOOR_Y },
        { x: 320, y: FLOOR_Y },
      ],
    });
    arm(world, 0);
    shoot(world, { aimX: 1 });
    expect(health(world, 1)).toBe(C.maxHealth - 1);
    expect(health(world, 0)).toBe(C.maxHealth);
    expect(eventsOf(world, "explosion")).toHaveLength(1);
  });

  it("should remove exactly one chunk from every other player in range when one blast hits several", () => {
    const world = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
        { x: 330, y: FLOOR_Y },
      ],
    });
    explode(world.ctx(), p0Blast({ x: 315, y: FLOOR_Y - 10 }));
    expect(health(world, 1)).toBe(C.maxHealth - 1);
    expect(health(world, 2)).toBe(C.maxHealth - 1);
    expect(health(world, 0)).toBe(C.maxHealth);
  });

  it("should remove exactly one chunk when the blast hits a victim from behind", () => {
    const world = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });
    world.players[1]!.facing = -1; // faces left, blast comes from the left → front
    explode(world.ctx(), p0Blast({ x: 320, y: FLOOR_Y - 14 })); // from the right → back
    expect(health(world, 1)).toBe(C.maxHealth - 1);
    expect(eventsOfLive(world.combat, "playerHit")[0]).toMatchObject({ zone: "back", damage: 1 });
  });

  it("should never damage the shooter when the shooter stands in their own blast", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    explode(world.ctx(), p0Blast({ x: 200, y: FLOOR_Y }));
    expect(health(world, 0)).toBe(C.maxHealth);
    expect(world.players[0]!.vy).toBeLessThan(0);
  });

  it("should push away from the blast and weaker with distance when players are in range", () => {
    const near = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });
    const far = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });
    const outside = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });
    const blastY = FLOOR_Y - P.height / 2;
    explode(near.ctx(), p0Blast({ x: 270, y: blastY }));
    explode(far.ctx(), p0Blast({ x: 240, y: blastY }));
    explode(
      outside.ctx(),
      p0Blast({ x: 286 - C.blast.reachPerPower * ROCKET_POWER - 1, y: blastY })
    );
    const nearVx = near.players[1]!.vx;
    const farVx = far.players[1]!.vx;
    expect(nearVx).toBeGreaterThan(0);
    expect(farVx).toBeGreaterThan(0);
    expect(nearVx).toBeGreaterThan(farVx);
    expect(Math.abs(near.players[1]!.vy)).toBeLessThan(1e-9);
    expect(outside.players[1]!.vx).toBe(0);
    expect(health(outside, 1)).toBe(C.maxHealth);
  });

  it("should push a hit player by hitPushScale of the shooter's push when both are equally far", () => {
    // Shooter at x 260, victim at x 340: the blast between them is 40 from each body centre.
    const world = createWorld({
      at: [
        { x: 260, y: FLOOR_Y },
        { x: 340, y: FLOOR_Y },
      ],
    });
    explode(world.ctx(), p0Blast({ x: 300, y: FLOOR_Y - P.height / 2 }));
    const shooterPush = Math.abs(world.players[0]!.vx);
    const victimPush = Math.abs(world.players[1]!.vx);
    expect(shooterPush).toBeGreaterThan(0);
    expect(victimPush / shooterPush).toBeCloseTo(C.blast.hitPushScale);
  });
});

describe("combat — blast hurt reaction", () => {
  const blastY = FLOOR_Y - P.height / 2;
  const twoPlayers = () =>
    createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });

  it("should send a victim rolling off the floor and to rest when the blast is close", () => {
    const world = twoPlayers();
    const victim = world.players[1]!;
    explode(world.ctx(), p0Blast({ x: 284, y: blastY + 6 }));
    expect(victim.rollSource).toBe("hit");
    world.step([], 900);
    expect(victim.rollBounceCount).toBeGreaterThan(0);
    expect(victim.rollSource).toBeNull();
  });

  it("should roll the victim shorter when the blast is at the edge of its range", () => {
    const close = twoPlayers();
    explode(close.ctx(), p0Blast({ x: 284, y: blastY + 6 }));
    const edge = twoPlayers();
    explode(edge.ctx(), p0Blast({ x: 240, y: blastY }));
    expect(edge.players[1]!.vx).toBeGreaterThan(0);
    expect(edge.players[1]!.rollLockSeconds).toBeGreaterThan(0);
    expect(edge.players[1]!.rollLockSeconds).toBeLessThan(close.players[1]!.rollLockSeconds);
  });

  it("should never send the shooter rolling when they stand in their own blast", () => {
    const world = twoPlayers();
    explode(world.ctx(), p0Blast({ x: 100, y: FLOOR_Y }));
    expect(world.players[0]!.vy).toBeLessThan(0);
    expect(world.players[0]!.rollSource).toBeNull();
  });
});

describe("combat — rocket recoil", () => {
  it("should kick the shooter back opposite the aim by the recoil when a rocket is fired", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    arm(world, 0);
    world.step([{ aimX: 1, aimY: 0, fire: true }]);
    expect(eventsOf(world, "rocketFired")).toHaveLength(1);
    expect(world.players[0]!.vx).toBeCloseTo(-C.rocket.recoil, 6);
  });

  it("should lift the shooter off the ground when firing straight down", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    arm(world, 0);
    const fighter = world.combat.fighters.get("p0")!;
    const shooter = world.players[0]!;
    // Fire through stepAttacks alone so the rocket's blast does not mask the recoil.
    shooter.aimX = 0;
    shooter.aimY = 1;
    stepAttacks(world.ctx(), [{ ...EMPTY_PLAYER_INPUT, connected: true, fire: true }], { dt });
    expect(fighter.weapon?.ammo).toBe(C.rocket.ammo - 1);
    expect(shooter.vy).toBeCloseTo(-C.rocket.recoil, 6);
    expect(shooter.grounded).toBe(false);
  });
});

describe("combat — rockets", () => {
  it("should lift the shooter higher than a full jump when firing straight down from standing", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    arm(world, 0);
    const press: InputPatch[] = [{ aimY: 1, aimX: 0, fire: true }];
    world.step(press);
    let minY = world.players[0]!.y;
    for (let i = 0; i < 120; i += 1) {
      world.step([{ aimY: 1, aimX: 0 }]);
      minY = Math.min(minY, world.players[0]!.y);
    }
    const jumpApex = (P.jumpSpeed * P.jumpSpeed) / (2 * G);
    expect(FLOOR_Y - minY).toBeGreaterThan(jumpApex * 1.3);
    expect(health(world, 0)).toBe(C.maxHealth);
  });

  it("should explode at a one-cell wall and not pass through it when the rocket flies at max speed", () => {
    const tunables: GameTunables = {
      ...DEFAULT_GAME_TUNABLES,
      combat: { ...C, rocket: { ...C.rocket, speed: 30000 } },
    };
    const world = createWorld({
      at: [
        { x: 700, y: FLOOR_Y },
        { x: 900, y: FLOOR_Y },
      ],
      tunables,
    });
    arm(world, 0);
    shoot(world, { aimX: 1 }, 10);
    const [blast] = eventsOf(world, "explosion");
    expect(blast).toBeDefined();
    expect(blast!.x).toBeGreaterThanOrEqual(800);
    expect(blast!.x).toBeLessThanOrEqual(808);
    expect(health(world, 1)).toBe(C.maxHealth);
    expect(getCellInfo(world.ctx().terrain, 100, 20)?.materialId).toBe("stone");
  });

  it("should explode on a player and not pass through when the rocket flies at max speed", () => {
    const tunables: GameTunables = {
      ...DEFAULT_GAME_TUNABLES,
      combat: { ...C, rocket: { ...C.rocket, speed: 30000 } },
    };
    const world = createWorld({
      at: [
        { x: 200, y: FLOOR_Y },
        { x: 600, y: FLOOR_Y },
      ],
      tunables,
    });
    arm(world, 0);
    shoot(world, { aimX: 1 }, 10);
    const [blast] = eventsOf(world, "explosion");
    expect(blast!.x).toBeGreaterThanOrEqual(600 - P.width / 2 - C.rocket.radius);
    expect(blast!.x).toBeLessThanOrEqual(600);
    expect(health(world, 1)).toBe(C.maxHealth - 1);
  });

  it("should clear only breakable cells and emit the material's effect and sound when a blast hits mixed terrain", () => {
    const world = createWorld({ at: [{ x: 100, y: FLOOR_Y }] });
    const terrain = world.ctx().terrain;
    explode(world.ctx(), p0Blast({ x: 480, y: 184 }));
    // Dirt cell at (480, 176) is gone; the stone strip at y 184–192 stays.
    expect(getCellInfo(terrain, 60, 22)).toBeNull();
    expect(getCellInfo(terrain, 60, 23)?.materialId).toBe("stone");
    const destroyed = eventsOfLive(world.combat, "terrainDestroyed");
    expect(destroyed).toHaveLength(1);
    expect(destroyed[0]).toMatchObject({
      materialId: "earth",
      effectId: "dust-burst",
      soundId: "crumble",
    });
    expect(destroyed[0]!.cells).toBeGreaterThan(0);
  });

  it("should flag the victim eliminated with credit to the shooter when the last chunk is lost", () => {
    const world = createWorld({
      at: [
        { x: 200, y: FLOOR_Y },
        { x: 320, y: FLOOR_Y },
      ],
    });
    world.combat.fighters.get("p1")!.health = 1;
    arm(world, 0);
    shoot(world, { aimX: 1 }, 30);
    expect(world.combat.fighters.get("p1")!.eliminated).toBe(true);
    expect(eventsOf(world, "playerEliminated")).toEqual([
      expect.objectContaining({ victimSlot: 1, byPlayerSlot: 0, cause: "rocket" }),
    ]);
  });

  it("should take no damage but still be pushed when the player is spawn-protected", () => {
    const world = createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 300, y: FLOOR_Y },
      ],
    });
    world.combat.fighters.get("p1")!.invulnerableUntil = world.time() + 5;
    explode(world.ctx(), p0Blast({ x: 280, y: FLOOR_Y - 14 }));
    expect(health(world, 1)).toBe(C.maxHealth);
    expect(world.players[1]!.vx).toBeGreaterThan(0);
  });
});

describe("combat — spray weapons (torch, fire-spread b1)", () => {
  const hold = (
    world: World,
    steps: number,
    options: { onSpray?: () => void; fire?: boolean } = {}
  ): void => {
    for (let i = 0; i < steps; i += 1) {
      const fire = options.fire ?? true;
      stepAttacks(world.ctx(), [{ ...EMPTY_PLAYER_INPUT, connected: true, fire }], {
        dt,
        sprayAttack: options.onSpray,
      });
    }
  };
  const armTorch = (world: World): void => {
    world.combat.fighters.get("p0")!.weapon = { itemId: "torch", ammo: C.torch.ammo };
  };

  it("should spray every held step and drop the torch when its fuel runs out", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    armTorch(world);
    let sprays = 0;
    const fuelSteps = Math.round(C.torch.ammo / dt);
    hold(world, fuelSteps - 1, { onSpray: () => (sprays += 1) });
    expect(world.combat.fighters.get("p0")!.weapon?.itemId).toBe("torch");
    hold(world, 2, { onSpray: () => (sprays += 1) });
    expect(world.combat.fighters.get("p0")!.weapon).toBeNull();
    expect(sprays).toBe(fuelSteps);
  });

  it("should not drain fuel when the fire button is not held", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    armTorch(world);
    hold(world, 120, { fire: false });
    expect(world.combat.fighters.get("p0")!.weapon?.ammo).toBe(C.torch.ammo);
  });

  it("should not spray when the held weapon is a launcher", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    arm(world, 0, "rocket-launcher");
    let sprays = 0;
    hold(world, 10, { onSpray: () => (sprays += 1) });
    expect(sprays).toBe(0);
  });

  it("should neither spray nor drain when the holder is eliminated", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    armTorch(world);
    world.combat.fighters.get("p0")!.eliminated = true;
    let sprays = 0;
    hold(world, 30, { onSpray: () => (sprays += 1) });
    expect(sprays).toBe(0);
    expect(world.combat.fighters.get("p0")!.weapon?.ammo).toBe(C.torch.ammo);
  });

  it("should emit one start cue when spraying starts and another after a pause", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    armTorch(world);
    hold(world, 10);
    hold(world, 2, { fire: false });
    hold(world, 10);
    const starts = world.combat.events.filter((event) => event.type === "torchStarted");
    expect(starts).toHaveLength(2);
  });
});

describe("combat — unarmed fire", () => {
  it("should call the unarmed-attack hook once per press only while the player is unarmed", () => {
    const world = createWorld({ at: [{ x: 200, y: FLOOR_Y }] });
    const calls: number[] = [];
    const press = (fire: boolean): void =>
      stepAttacks(world.ctx(), [{ ...EMPTY_PLAYER_INPUT, connected: true, fire }], {
        dt,
        unarmedAttack: ({ attacker }) => calls.push(attacker.slot),
      });
    press(true);
    press(true);
    expect(calls).toEqual([0]);
    arm(world, 0);
    press(false);
    press(true);
    expect(calls).toEqual([0]);
  });

  it("should do nothing when an unarmed player presses fire next to another player", () => {
    const world = createWorld({
      at: [
        { x: 200, y: FLOOR_Y },
        { x: 236, y: FLOOR_Y },
      ],
    });
    const before = { ...world.players[1]! };
    world.step([{ aimX: 1, fire: true }], 10);
    expect(health(world, 1)).toBe(C.maxHealth);
    expect(world.players[1]!.x).toBe(before.x);
    expect(world.seen).toEqual([]);
  });
});

describe("combat — out of bounds", () => {
  it("should credit the last hitter when a player falls out soon after being hit", () => {
    const world = createWorld({
      at: [
        { x: 200, y: FLOOR_Y },
        { x: 236, y: FLOOR_Y },
      ],
    });
    applyHit(world.ctx(), {
      victimSlot: 1,
      attackerSlot: 0,
      kind: "contact",
      source: "dive",
      contactPoint: { x: 222, y: FLOOR_Y - 14 },
      direction: { x: 1, y: 0 },
    });
    eliminateFighter({
      combat: world.combat,
      player: world.players[1]!,
      cause: "out-of-bounds",
      tunables: DEFAULT_GAME_TUNABLES,
      timeSeconds: world.time() + 1,
    });
    expect(eventsOfLive(world.combat, "playerEliminated")).toEqual([
      expect.objectContaining({ victimSlot: 1, byPlayerSlot: 0, cause: "out-of-bounds" }),
    ]);
  });
});

describe("combat — homing missiles", () => {
  const H = C.homing;
  // Shooter at x 100, opponent 400 units right on the same floor; the stone wall is at x 800.
  const duel = (): World =>
    createWorld({
      at: [
        { x: 100, y: FLOOR_Y },
        { x: 500, y: FLOOR_Y },
      ],
    });
  const missile = (world: World) => world.combat.rockets.find((r) => r.kind === "homing");
  const distanceToTarget = (world: World): number => {
    const m = missile(world);
    const t = world.players[1]!;
    return m ? Math.hypot(m.x - t.x, m.y - (t.y - t.height / 2)) : Infinity;
  };
  // Aimed 30° above the opponent: a straight rocket sails over them.
  const highAim: InputPatch = { aimX: 1, aimY: -0.58 };

  it("should curve into a standing opponent when the shot is aimed off to the side", () => {
    const world = duel();
    arm(world, 0, "homing-launcher");
    shoot(world, highAim, 240);
    expect(health(world, 1)).toBe(C.maxHealth - 1);
  });

  it("should miss with a plain rocket when the same off-side shot is fired", () => {
    const world = duel();
    arm(world, 0);
    shoot(world, highAim, 240);
    expect(health(world, 1)).toBe(C.maxHealth);
  });

  it("should miss an opponent who jumps when the missile is close", () => {
    const world = duel();
    arm(world, 0, "homing-launcher");
    world.step([{ aimX: 1, fire: true }]);
    let jumped = false;
    for (let i = 0; i < 480; i += 1) {
      jumped ||= distanceToTarget(world) < 90;
      world.step([{ aimX: 1 }, { jump: jumped }]);
    }
    expect(jumped).toBe(true);
    expect(health(world, 1)).toBe(C.maxHealth);
    expect(eventsOf(world, "explosion")).toHaveLength(1);
  });

  it("should lock the nearest opponent in the aim cone when fired", () => {
    const world = createWorld({
      at: [
        { x: 300, y: FLOOR_Y },
        { x: 100, y: FLOOR_Y }, // behind the shooter: outside the cone
        { x: 600, y: FLOOR_Y },
      ],
    });
    arm(world, 0, "homing-launcher");
    world.step([{ aimX: 1, fire: true }]);
    expect(missile(world)?.targetId).toBe("p2");
  });

  it("should fly straight when no opponent is inside the aim cone", () => {
    const world = duel();
    arm(world, 0, "homing-launcher");
    world.step([{ aimX: -1, fire: true }]);
    world.step([{ aimX: -1 }], 12); // short of the bounds at x 0
    expect(missile(world)).toMatchObject({ targetId: null, dirX: -1, dirY: 0 });
  });

  it("should stop turning once its steering fuel runs out", () => {
    const world = duel();
    arm(world, 0, "homing-launcher");
    world.step([{ aimX: -1, aimY: -1, fire: true }]); // away from the target, up-left
    const m = missile(world)!;
    m.targetId = "p1"; // force a lock it cannot reach in time
    world.step([], Math.round(H.fuelSeconds / dt));
    const heading = { x: m.dirX, y: m.dirY };
    world.step([], 20);
    expect(m.dirX).toBeCloseTo(heading.x, 6);
    expect(m.dirY).toBeCloseTo(heading.y, 6);
  });

  it("should use the homing ammo, cooldown and recoil when the homing launcher fires", () => {
    const world = duel();
    takeWeaponPickups(world.ctx(), {
      spawned: [],
      collected: [{ itemId: "homing-launcher", slot: 0 }],
    });
    const fighter = world.combat.fighters.get("p0")!;
    expect(fighter.weapon).toEqual({ itemId: "homing-launcher", ammo: H.ammo });
    world.step([{ aimX: 1, fire: true }]);
    expect(fighter.attackCooldown).toBe(H.fireCooldown); // set after this step's countdown
    expect(eventsOf(world, "rocketFired")[0]).toMatchObject({ kind: "homing" });
  });
});

function eventsOfLive<T extends CombatEvent["type"]>(combat: CombatState, type: T) {
  return combat.events.filter(
    (event): event is Extract<CombatEvent, { type: T }> => event.type === type
  );
}
