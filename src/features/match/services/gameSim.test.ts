import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { applyHit } from "@/features/combat/api/combatApi";
import { catchFire } from "@/features/fire/api/fireApi";
import { createGameState, stepGame } from "@/features/match/services/gameSim";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [{ shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, materialId: "stone" }],
  spawns: [
    { x: 100, y: 200 },
    { x: 600, y: 200 },
  ],
  drops: [],
  collectibles: [],
  bounds: { x: -100, y: -100, w: 1000, h: 600 },
};

const dt = 1 / 120;
const keys = (...codes: string[]) => mapPlayerInputs({ heldKeys: new Set(codes), gamepads: [] });
const respawnDelay = DEFAULT_GAME_TUNABLES.match.respawnDelaySeconds;
/** Steps the game for `seconds` of sim time with the given inputs. */
const stepFor = (state: ReturnType<typeof createGameState>, seconds: number, inputs = keys()) => {
  for (let t = 0; t < seconds; t += dt) stepGame(state, inputs, dt);
  return state;
};
const newGame = (matchDurationS?: number) =>
  createGameState({
    level: { ...level, settings: { ...level.settings, matchDurationS } },
    tunables: DEFAULT_GAME_TUNABLES,
  });

describe("gameSim", () => {
  it("should move the keyboard-1 player right and land it on solid cells when right is held", () => {
    const state = newGame();
    for (let i = 0; i < 120; i += 1) stepGame(state, keys("KeyD"), dt);
    const player = state.players.find((p) => p.slot === 0);
    expect(player?.x).toBeGreaterThan(100 + 300);
    expect(player?.y).toBe(320);
    expect(player?.grounded).toBe(true);
    const other = state.players.find((p) => p.slot === 1);
    expect(other?.x).toBe(600);
  });

  it("should add a player only for connected slots", () => {
    const state = stepGame(newGame(), keys(), dt);
    expect(state.players.map((p) => p.slot)).toEqual([0, 1]);
  });

  it("should respawn a player who leaves the out-of-bounds zone", () => {
    const state = stepGame(newGame(), keys(), dt);
    const player = state.players[0]!;
    player.y = 2000;
    stepFor(state, respawnDelay + 0.05);
    expect(player.y).toBeLessThan(250);
  });

  it("should report the fall as an elimination and refill health when a player leaves the zone", () => {
    const state = stepGame(newGame(), keys(), dt);
    const fighter = state.combat.fighters.get("p0")!;
    fighter.health = 2;
    state.players[0]!.y = 2000;
    stepGame(state, keys(), dt);
    expect(state.combat.events).toContainEqual(
      expect.objectContaining({ type: "playerEliminated", victimSlot: 0, cause: "out-of-bounds" })
    );
    stepFor(state, respawnDelay);
    expect(fighter).toMatchObject({
      health: DEFAULT_GAME_TUNABLES.combat.maxHealth,
      eliminated: false,
    });
  });

  it("should let a rocket fly on past the bounds top when it is still inside the kill zone", () => {
    const state = stepGame(newGame(), keys(), dt);
    const start = { x: 300, y: level.bounds.y + 50 };
    state.combat.rockets.push({
      id: 99,
      kind: "rocket",
      targetId: null,
      ownerSlot: 0,
      ownerId: "p0",
      ...start,
      dirX: 0,
      dirY: -1,
      age: 0,
    });
    stepFor(state, 0.5);
    expect(state.combat.events.filter((e) => e.type === "explosion")).toEqual([]);
    expect(state.combat.rockets[0]?.y).toBeLessThan(level.bounds.y - 300);
  });

  it("should respawn a player whose last health chunk was lost to a hit", () => {
    const state = stepGame(newGame(), keys(), dt);
    const victim = state.players[1]!;
    victim.x = 300;
    state.combat.fighters.get("p1")!.health = 1;
    applyHit(
      { ...state, players: state.players },
      {
        victimSlot: 1,
        attackerSlot: 0,
        kind: "contact",
        source: "dive",
        contactPoint: { x: 300, y: 300 },
        direction: { x: -1, y: 0 },
      }
    );
    stepGame(state, keys(), dt);
    expect(state.combat.events).toContainEqual(
      expect.objectContaining({
        type: "playerEliminated",
        victimSlot: 1,
        byPlayerSlot: 0,
        cause: "dive",
      })
    );
    stepFor(state, respawnDelay);
    expect(victim.x).toBe(600); // farthest from the opponent at x = 100
    expect(state.combat.fighters.get("p1")!.health).toBe(DEFAULT_GAME_TUNABLES.combat.maxHealth);
  });

  it("should end the round and freeze players when the timer runs out", () => {
    const state = newGame(1);
    for (let i = 0; i < 130; i += 1) stepGame(state, keys(), dt);
    expect(state.round).toMatchObject({ phase: "ended", remainingSeconds: 0 });
    const frozenX = state.players[0]!.x;
    stepGame(state, keys("KeyD"), dt);
    expect(state.players[0]!.x).toBe(frozenX);
  });
});

describe("gameSim level settings", () => {
  it("should scale gravity and override the round length from the level settings", () => {
    const state = createGameState({
      level: { ...level, settings: { cellSize: 8, gravity: 0.5, matchDurationS: 60 } },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    expect(state.tunables.world.gravity).toBe(DEFAULT_GAME_TUNABLES.world.gravity * 0.5);
    expect(state.round.remainingSeconds).toBe(60);
  });

  it("should run on a level with unknown IDs and report them", () => {
    const state = createGameState({
      level: {
        ...level,
        terrain: [
          {
            shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 },

            materialId: "lava",
          },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    expect(state.levelWarnings).toEqual(['terrain[0]: unknown material "lava", using "stone"']);
    for (let i = 0; i < 120; i += 1) stepGame(state, keys(), dt);
    expect(state.players[0]?.grounded).toBe(true);
  });
});

describe("gameSim — dive headbutt", () => {
  // Acceptance test of the dive-headbutt lap (BRIEF.md § Success check).
  it("should land one typed dive hit and knock the opponent away when player 1 fires toward them", () => {
    const state = createGameState({
      level: {
        ...level,
        spawns: [
          { x: 300, y: 320 },
          { x: 360, y: 320 },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepGame(state, keys(), dt);
    const hits = [];
    let victimFarthestX = 0;
    for (let i = 0; i < 90; i += 1) {
      // Fire + right for the first steps only (one press), then hands off.
      stepGame(state, i < 3 ? keys("KeyF", "KeyD") : keys(), dt);
      hits.push(...state.dive.hits);
      victimFarthestX = Math.max(victimFarthestX, state.players[1]!.x);
    }
    expect(hits).toHaveLength(1);
    // Player 2 spawns facing right, away from the attacker: a back hit.
    expect(hits[0]).toMatchObject({
      attackerSlot: 0,
      victimSlot: 1,
      kind: "contact",
      source: "dive",
      zone: "back",
      damage: DEFAULT_GAME_TUNABLES.combat.hitDamage.contact.back,
    });
    expect(state.combat.fighters.get("p1")?.health).toBe(
      DEFAULT_GAME_TUNABLES.combat.maxHealth - DEFAULT_GAME_TUNABLES.combat.hitDamage.contact.back
    );
    expect(hits[0]!.impulse.x).toBeGreaterThan(0);
    expect(victimFarthestX).toBeGreaterThan(360 + 100);
  });

  const closeSpawns = () => {
    const state = createGameState({
      level: {
        ...level,
        spawns: [
          { x: 300, y: 320 },
          { x: 360, y: 320 },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepGame(state, keys(), dt);
    return state;
  };
  /** Player 1 presses fire + right once, then the sim runs until the dive hits (or gives up). */
  const diveUntilHit = (state: ReturnType<typeof createGameState>): void => {
    for (let i = 0; i < 90 && (i < 3 || state.dive.hits.length === 0); i += 1) {
      stepGame(state, i < 3 ? keys("KeyF", "KeyD") : keys(), dt);
    }
  };

  it("should score the kill and give the victim a fresh dive and no roll when a dive takes the last chunk", () => {
    const state = closeSpawns();
    const victim = state.players[1]!;
    state.combat.fighters.get(victim.id)!.health = 1;
    diveUntilHit(state);
    expect(state.dive.hits).toHaveLength(1);
    expect(state.rules.scores[0]).toBe(DEFAULT_GAME_TUNABLES.match.scoring.kill);
    expect(state.rules.respawnAt.has(victim.id)).toBe(true);
    stepFor(state, respawnDelay + 0.05);
    expect(state.rules.respawnAt.has(victim.id)).toBe(false);
    expect(victim.rollSource).toBeNull();
    expect(state.dive.motions[victim.id]).toMatchObject({ phase: "idle", stagger: 0, cooldown: 0 });
    expect(state.combat.fighters.get(victim.id)!.invulnerableUntil).toBeGreaterThan(
      state.timeSeconds
    );
  });

  it("should not bump or hit a player who is waiting to respawn", () => {
    const state = closeSpawns();
    const waiting = state.players[1]!;
    state.rules.respawnAt.set(waiting.id, state.timeSeconds + 10);
    const before = { x: waiting.x, y: waiting.y };
    for (let i = 0; i < 90; i += 1) {
      stepGame(state, i < 3 ? keys("KeyF", "KeyD") : keys(), dt);
      expect(state.dive.hits).toHaveLength(0);
    }
    expect({ x: waiting.x, y: waiting.y }).toEqual(before);
    expect(state.players[0]!.x).toBeGreaterThan(360);
  });
});

describe("gameSim — headbutt reset", () => {
  /** One player standing at x 100; a headbutt reset hangs in the air at (100, 120). */
  const gameWithRefill = () => {
    const state = createGameState({
      level: { ...level, collectibles: [{ at: { x: 100, y: 120 }, itemId: "dive-reset" }] },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepFor(state, 1);
    return { state, player: state.players[0]!, refill: state.collectibles.diveRefills[0]! };
  };

  it("should leave the pickup in place when a player who still holds the charge flies through it", () => {
    const { state, player, refill } = gameWithRefill();
    player.y = 130;
    player.grounded = false;
    stepGame(state, keys(), dt);
    expect(refill.respawnTimer).toBe(0);
  });

  it("should refill the dive mid-air when a player with a spent charge touches it", () => {
    const { state, player, refill } = gameWithRefill();
    player.y = 130;
    player.grounded = false;
    state.dive.motions[player.id]!.charged = false;
    stepGame(state, keys(), dt);
    expect(refill.respawnTimer).toBeGreaterThan(0);
    expect(state.dive.motions[player.id]!.charged).toBe(true);
    expect(state.dive.refillCounts[player.id]).toBe(1);
  });
});

describe("gameSim — burning blobs (fire-burn b2)", () => {
  it("should run a burning blob from the fire and take only the first chunk when it crouches", () => {
    const state = stepGame(newGame(), keys(), dt);
    const player = state.players[0]!;
    const startX = player.x;
    // The fire came from the left (the floor ends 100 units left of the spawn: it would run off).
    catchFire(state.fire, player, { now: state.timeSeconds, fromX: startX - 50, bySlot: 1 });
    stepFor(state, 0.3);
    expect(player.x).toBeGreaterThan(startX + 40);
    // Crouching is the player's own input: the flee stops; the mid-burn chunk still lands (not
    // halved), the end chunk is skipped (owner fire-burn D10).
    stepFor(state, DEFAULT_GAME_TUNABLES.fire.blob.burnSeconds - 0.25, keys("KeyS"));
    expect(state.fire.blobs.size).toBe(0);
    expect(state.fire.blobMoments.map((moment) => moment.kind)).toEqual(["smoke"]);
    expect(state.combat.fighters.get(player.id)?.health).toBe(
      DEFAULT_GAME_TUNABLES.combat.maxHealth - 1
    );
    expect(state.combat.fighters.get(player.id)?.lastHitBySlot).toBe(1);
  });
});

describe("gameSim — moving parts (LEVEL_FORMAT § 11)", () => {
  it("should carry a standing player up with a rising lift when the level has a moving part", () => {
    // A lift under the slot-0 spawn rises 160 and back every 4 s (LEVEL_FORMAT § 11).
    const lift = {
      shape: { type: "rect", x: 40, y: 288, w: 120, h: 32 },
      materialId: "stone",
    } as const;
    const state = createGameState({
      level: {
        ...level,
        terrain: [...level.terrain, lift],
        movers: [
          {
            motion: { kind: "slide", offset: { x: 0, y: -160 }, periodS: 4, phase: 0 },
            pivot: { x: 100, y: 304 },
            terrainIndices: [1],
          },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepFor(state, 2);
    const player = state.players.find((p) => p.slot === 0)!;
    expect(player.grounded).toBe(true);
    expect(player.x).toBeCloseTo(100, 0);
    expect(Math.abs(player.y - 128)).toBeLessThan(3);
  });
});

describe("gameSim — moving parts squeeze and crush (owner D13, change round on #64)", () => {
  it("should eliminate a player a moving part squeezes against a wall (crush)", () => {
    // Slot 0 spawns at x 100 between a slider (x 0–60) and a wall (x 180–220); the slider runs
    // right 160 in 2 s (LEVEL_FORMAT § 11, owner crush rule D13).
    const wall = {
      shape: { type: "rect", x: 180, y: 200, w: 40, h: 120 },
      materialId: "stone",
    } as const;
    const slider = {
      shape: { type: "rect", x: 0, y: 260, w: 60, h: 60 },
      materialId: "stone",
    } as const;
    const state = createGameState({
      level: {
        ...level,
        terrain: [...level.terrain, wall, slider],
        movers: [
          {
            motion: { kind: "slide", offset: { x: 160, y: 0 }, periodS: 4, phase: 0 },
            pivot: { x: 30, y: 290 },
            terrainIndices: [2],
          },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepFor(state, 2);
    const crush = state.combat.events.find(
      (event) => event.type === "playerEliminated" && event.cause === "crush"
    );
    expect(crush).toMatchObject({ victimSlot: 0, squeeze: { mover: 0 } });
  });

  it("should let a player squeezed into a gap of 80% of its width survive, jump out and recover", () => {
    // Same wall; the slider stops 22 units short of it (22 / 28 ≈ 0.79), owner change round on #64.
    const wall = {
      shape: { type: "rect", x: 180, y: 200, w: 40, h: 120 },
      materialId: "stone",
    } as const;
    const slider = {
      shape: { type: "rect", x: 0, y: 260, w: 60, h: 60 },
      materialId: "stone",
    } as const;
    const state = createGameState({
      level: {
        ...level,
        terrain: [...level.terrain, wall, slider],
        movers: [
          {
            motion: { kind: "slide", offset: { x: 98, y: 0 }, periodS: 4, phase: 0 },
            pivot: { x: 30, y: 290 },
            terrainIndices: [2],
          },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepFor(state, 2);
    const player = state.players.find((p) => p.slot === 0)!;
    expect(player.squeeze?.scale).toBeLessThan(0.9);
    const yBefore = player.y;
    stepFor(state, 0.15, keys("Space"));
    expect(player.y).toBeLessThan(yBefore - 20);
    stepFor(state, 2);
    expect(player.squeeze).toBeNull();
    const crushed = state.combat.events.some(
      (event) => event.type === "playerEliminated" && event.cause === "crush"
    );
    expect(crushed).toBe(false);
    expect(state.combat.fighters.get(player.id)?.eliminated).toBe(false);
  });

  it("should play a part's declared end sound at each turning point and nothing for a silent part", () => {
    const lift = {
      shape: { type: "rect", x: 300, y: 200, w: 80, h: 24 },
      materialId: "stone",
    } as const;
    const mover = {
      motion: { kind: "slide", offset: { x: 0, y: -80 }, periodS: 2, phase: 0 },
      pivot: { x: 340, y: 212 },
      terrainIndices: [1],
    } as const;
    const withSounds = (sounds?: { end: string }) =>
      createGameState({
        level: {
          ...level,
          terrain: [...level.terrain, lift],
          movers: [{ ...mover, ...(sounds && { sounds }) }],
        },
        tunables: DEFAULT_GAME_TUNABLES,
      });
    // The event log keeps only recent events, so collect them step by step.
    const partSounds = (state: ReturnType<typeof newGame>, seconds: number) => {
      const seen = new Set<number>();
      for (let t = 0; t < seconds; t += dt) {
        stepGame(state, keys(), dt);
        for (const event of state.combat.events)
          if (event.type === "partSound") seen.add(event.seq);
      }
      return seen.size;
    };
    // Ends at 1 s (top) and 2 s (rest) of a 2 s slide.
    expect(partSounds(withSounds({ end: "thud" }), 2.05)).toBe(2);
    expect(partSounds(withSounds(), 2.05)).toBe(0);
  });
});
