import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { applyHit } from "@/features/combat/api/combatApi";
import { catchFire } from "@/features/blob-fire/api/blobFireApi";
import { chillBlob, isFrozen, isIced } from "@/features/ice/api/iceApi";
import { parseLevelFile } from "@/features/level-file/api/levelFileApi";
import { escapeSolid, hurtHeight, type PlayerState } from "@/features/player/api/playerApi";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import { createGameState, playersInPlay, stepGame } from "@/features/match/services/gameSim";

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
    // Knocked away like a direct rocket hit (bash-matches-rocket lap).
    expect(victimFarthestX).toBeGreaterThan(360 + 2 * DEFAULT_GAME_TUNABLES.player.width);
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
    catchFire(state.blobFire, player, { now: state.timeSeconds, fromX: startX - 50, bySlot: 1 });
    stepFor(state, 0.3);
    expect(player.x).toBeGreaterThan(startX + 40);
    // Crouching is the player's own input: the flee stops; the mid-burn chunk still lands (not
    // halved), the end chunk is skipped (owner fire-burn D10).
    stepFor(state, DEFAULT_GAME_TUNABLES.fire.blob.burnSeconds - 0.25, keys("KeyS"));
    expect(state.blobFire.blobs.size).toBe(0);
    expect(state.blobFire.blobMoments.map((moment) => moment.kind)).toEqual(["smoke"]);
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

describe("gameSim — joining next to a moving part (level-orbit D4)", () => {
  it("should join a player at an open spawn when a moving part covers its slot spawn", () => {
    // A slow spinning block sits over the slot-0 spawn (100, 200) at time 0 (moving-parts D15).
    const block = {
      shape: { type: "rect", x: 60, y: 140, w: 80, h: 80 },
      materialId: "stone",
    } as const;
    const state = createGameState({
      level: {
        ...level,
        terrain: [...level.terrain, block],
        movers: [
          {
            motion: { kind: "spin", periodS: 20, phase: 0, direction: 1 },
            pivot: { x: 100, y: 180 },
            terrainIndices: [1],
          },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepGame(state, keys(), dt);
    const player = state.players.find((p) => p.slot === 0)!;
    // Both keyboard players share the one open spawn, so the first step's bump moves them apart.
    expect(Math.abs(player.x - 600)).toBeLessThan(30);
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

describe("gameSim — beam clash (beam-clash D1, the steam wall)", () => {
  const C = DEFAULT_GAME_TUNABLES.combat;
  /** Two blobs 90 units apart, facing each other and holding fire for a second. */
  const sprayHeadOn = (left: "torch" | "freeze-ray", right: "torch" | "freeze-ray") => {
    const state = stepFor(newGame(), 3);
    const [a, b] = [state.players[0]!, state.players[1]!];
    a.x = 300;
    b.x = 390;
    const ammoOf = (itemId: "torch" | "freeze-ray") =>
      itemId === "torch" ? C.torch.ammo : C.freezeRay.ammo;
    state.combat.fighters.get(a.id)!.weapon = { itemId: left, ammo: ammoOf(left) };
    state.combat.fighters.get(b.id)!.weapon = { itemId: right, ammo: ammoOf(right) };
    const inputs = keys().map((input, slot) =>
      slot < 2 ? { ...input, fire: true, aimX: slot === 0 ? 1 : -1, aimY: 0 } : input
    );
    stepFor(state, 1, inputs);
    return { state, a, b };
  };

  it("should stop both beams where they meet when a torch and a freeze ray spray head-on", () => {
    const { state, a, b } = sprayHeadOn("torch", "freeze-ray");

    expect(state.combat.beamClashes).toHaveLength(1);
    // Neither beam got past: the ray holder does not burn, the torch holder gathers no chill,
    // and neither was pushed.
    expect(state.blobFire.blobs.size).toBe(0);
    expect(isIced(state.ice, a)).toBe(false);
    expect(a.x).toBeCloseTo(300, 0);
    expect(b.x).toBeCloseTo(390, 0);
  });

  it("should still land a beam when the other blob holds the same element", () => {
    const { state, b } = sprayHeadOn("torch", "torch");

    expect(state.combat.beamClashes).toEqual([]);
    expect(state.blobFire.caughtCounts[b.id] ?? 0).toBeGreaterThan(0);
  });
});

describe("gameSim — ice blocks (ice-frozen-blobs D1–D7)", () => {
  const B = DEFAULT_GAME_TUNABLES.ice.blob;
  /** A game past spawn protection with player 0 frozen solid. */
  const withFrozenBlob = () => {
    const state = stepFor(newGame(), 3);
    const player = state.players[0]!;
    const chill = {
      now: state.timeSeconds,
      dt: B.freezeSeconds,
      terrain: state.arena.terrain,
      tunables: state.tunables,
    };
    chillBlob(state.ice, player, chill);
    return { state, player };
  };

  it("should ignore a frozen blob's move input and give control back when the block ends", () => {
    const { state, player } = withFrozenBlob();
    const startX = player.x;
    stepFor(state, B.frozenSeconds - 0.2, keys("KeyD"));
    expect(isFrozen(state.ice, player)).toBe(true);
    expect(player.x).toBeCloseTo(startX, 0);
    stepFor(state, 0.7, keys("KeyD"));
    expect(isFrozen(state.ice, player)).toBe(false);
    expect(player.x).toBeGreaterThan(startX + 50);
  });

  it("should shatter the block and keep the hit when a hit lands on a frozen blob", () => {
    const { state, player } = withFrozenBlob();
    applyHit(
      { ...state, players: state.players },
      {
        victimSlot: 0,
        attackerSlot: 1,
        kind: "contact",
        source: "dive",
        contactPoint: { x: player.x, y: player.y },
        direction: { x: 1, y: 0 },
      }
    );
    stepGame(state, keys(), dt);
    expect(isFrozen(state.ice, player)).toBe(false);
    expect(state.ice.blobMoments.map((moment) => moment.kind)).toContain("shatter");
    // The hit itself is untouched: the chunks it took are gone.
    expect(state.combat.fighters.get(player.id)?.health).toBeLessThan(
      DEFAULT_GAME_TUNABLES.combat.maxHealth
    );
  });

  it("should take the shatter damage on top when a hit lands on a frozen blob", () => {
    const { state, player } = withFrozenBlob();
    stepGame(state, keys(), dt);
    const result = applyHit(
      { ...state, players: state.players },
      {
        victimSlot: 0,
        attackerSlot: 1,
        kind: "contact",
        source: "dive",
        contactPoint: { x: player.x, y: player.y },
        direction: { x: -player.facing, y: 0 },
      }
    );
    const C = DEFAULT_GAME_TUNABLES.combat;
    expect(result.damage).toBe(C.hitDamage.contact.front + B.shatterDamage);
  });

  it("should melt the block and not leave the blob burning when fire touches a frozen blob", () => {
    const { state, player } = withFrozenBlob();
    catchFire(state.blobFire, player, { now: state.timeSeconds, fromX: player.x - 50, bySlot: 1 });
    stepGame(state, keys(), dt);
    expect(isIced(state.ice, player)).toBe(false);
    expect(state.blobFire.blobs.size).toBe(0);
    expect(state.ice.blobMoments.map((moment) => moment.kind)).toContain("melt");
  });

  it("should put a burning blob out and keep no chill when a freeze ray reaches it", () => {
    const state = stepFor(newGame(), 3);
    const player = state.players[0]!;
    catchFire(state.blobFire, player, { now: state.timeSeconds, fromX: player.x - 50, bySlot: 1 });
    chillBlob(state.ice, player, {
      now: state.timeSeconds,
      dt,
      terrain: state.arena.terrain,
      tunables: state.tunables,
    });
    stepGame(state, keys(), dt);
    expect(state.blobFire.blobs.size).toBe(0);
    expect(isIced(state.ice, player)).toBe(false);
    expect(state.combat.fighters.get(player.id)?.health).toBe(
      DEFAULT_GAME_TUNABLES.combat.maxHealth
    );
  });
});

// Owner reports (2026-11-18), on the crusher test level's squeezer: a block (x 920–968) that
// slides 60 right toward a post (x 1048), leaving a 20-wide gap at its closest (t = 2 s).
const CRUSHER_LEVEL = (() => {
  const file = readFileSync(
    path.join(process.cwd(), "public/level-kit/v2/crusher-test-level.html"),
    "utf8"
  );
  const parsed = parseLevelFile(file);
  if (!parsed.ok) throw new Error("crusher test level did not parse");
  return parsed.level;
})();
const FLOOR_TOP = 840;

/** The crusher level with player 0 placed at `at`, holding `held(t)` for `seconds`. */
function onSqueezer(at: { x: number; y: number }, held: (t: number) => string[], seconds: number) {
  const state = createGameState({ level: CRUSHER_LEVEL, tunables: DEFAULT_GAME_TUNABLES });
  stepGame(state, keys(), dt);
  const player = state.players[0]!;
  Object.assign(player, { x: at.x, y: at.y, vx: 0, vy: 0 });
  for (let i = 0; i < seconds / dt; i += 1) stepGame(state, keys(...held(i * dt)), dt);
  return player;
}

describe("gameSim — leaving a squeeze", () => {
  it("should free the player at full size on the floor when the squeezing block pulls back", () => {
    // Squeezed against the post from 1.5 s to 2.5 s, then the block slides away.
    const player = onSqueezer({ x: 1036, y: FLOOR_TOP }, () => [], 4);
    expect(player.squeeze).toBeNull();
    expect(player.y).toBeCloseTo(FLOOR_TOP, 0);
    // Stayed by the post: not dragged along with the block (it is back near x 944).
    expect(player.x).toBeGreaterThan(1030);
  });

  it("should not stick the player to the block when it rides it into the post and the block leaves", () => {
    // Runs right off the block's top into the gap by the post, then lets go of the keys.
    const player = onSqueezer({ x: 944, y: 768 }, (t) => (t < 2 ? ["KeyD"] : []), 5);
    expect(player.squeeze).toBeNull();
    expect(player.y).toBeCloseTo(FLOOR_TOP, 0);
    expect(player.x).toBeGreaterThan(1030);
  });
});

/** Player 1 armed with a full rocket launcher, standing on the floor (spawns are 120 up). */
const armedGame = () => {
  const state = newGame();
  stepFor(state, 1);
  state.combat.fighters.get("p0")!.weapon = {
    itemId: "rocket-launcher",
    ammo: DEFAULT_GAME_TUNABLES.combat.rocket.ammo,
  };
  return state;
};
/** Jumps, lets go, then presses jump again high in the air while holding `extra` keys. */
const jumpThenAirPress = (state: ReturnType<typeof createGameState>, ...extra: string[]) => {
  stepFor(state, 0.05, keys("Space"));
  stepFor(state, 0.25);
  stepGame(state, keys("Space", ...extra), dt);
};

describe("gameSim — jump dive (double-jump-bash D1)", () => {
  // Acceptance test of the double-jump-bash lap (BRIEF.md § Success check).
  it("should start the dive and fire no rocket when an armed player presses jump in mid-air", () => {
    const state = armedGame();
    jumpThenAirPress(state, "KeyD");
    stepFor(state, DEFAULT_GAME_TUNABLES.dive.windupSeconds + 2 * dt);
    const motion = state.dive.motions.p0;
    expect(motion?.phase).toBe("travel");
    expect(motion?.dirX).toBeCloseTo(1);
    expect(state.combat.fighters.get("p0")?.weapon?.ammo).toBe(
      DEFAULT_GAME_TUNABLES.combat.rocket.ammo
    );
  });

  it("should roll on when jump is still held as the jump dive ends", () => {
    const state = armedGame();
    jumpThenAirPress(state, "KeyD");
    const d = DEFAULT_GAME_TUNABLES.dive;
    stepFor(state, d.windupSeconds + d.travelSeconds + 2 * dt, keys("Space", "KeyD"));
    expect(state.players[0]!.rollSource).toBe("dash");
  });

  it("should not dive when the first jump press leaves the ground", () => {
    const state = armedGame();
    stepFor(state, 0.2, keys("Space"));
    expect(state.dive.motions.p0?.phase ?? "idle").toBe("idle");
  });
});

describe("gameSim — jump dive rules (double-jump-bash D2, D5, D17)", () => {
  it("should dive straight up from a jump press with no stick, and along facing from fire", () => {
    const jumped = armedGame();
    jumpThenAirPress(jumped);
    stepFor(jumped, DEFAULT_GAME_TUNABLES.dive.windupSeconds + 2 * dt);
    expect(jumped.dive.motions.p0).toMatchObject({ phase: "travel", dirX: 0, dirY: -1 });

    const fired = newGame();
    stepFor(fired, 1);
    stepFor(fired, 0.05, keys("Space"));
    stepFor(fired, 0.25);
    stepGame(fired, keys("KeyF"), dt);
    stepFor(fired, DEFAULT_GAME_TUNABLES.dive.windupSeconds + 2 * dt);
    expect(fired.dive.motions.p0).toMatchObject({ phase: "travel", dirX: 1, dirY: 0 });
  });

  it("should start one dive only when fire and jump are pressed on the same step", () => {
    const state = newGame();
    stepFor(state, 1);
    stepFor(state, 0.05, keys("Space"));
    stepFor(state, 0.25);
    stepGame(state, keys("Space", "KeyF", "KeyD"), dt);
    stepFor(state, 1);
    // One dive spent the charge; the second press found nothing to start.
    expect(state.dive.motions.p0?.trigger).toBe("fire");
    expect(state.players[0]!.moveRollCount).toBe(0);
  });

  it("should not dive again with a jump press while the airtime's dive is spent", () => {
    const state = armedGame();
    jumpThenAirPress(state, "KeyD");
    const d = DEFAULT_GAME_TUNABLES.dive;
    stepFor(state, d.windupSeconds + d.travelSeconds + d.recoverySeconds + 0.05);
    expect(state.players[0]!.grounded).toBe(false);
    const travels = () => state.dive.motions.p0?.phase === "travel";
    stepGame(state, keys("Space", "KeyA"), dt);
    let dived = false;
    for (let i = 0; i < 40; i += 1) {
      stepGame(state, keys("Space"), dt);
      dived ||= travels();
    }
    expect(dived).toBe(false);
  });

  it("should jump, not dive, when a spent air press is followed by landing", () => {
    const state = armedGame();
    jumpThenAirPress(state, "KeyD");
    // Fall back to the floor with the dive spent, pressing jump just before touching down.
    let pressed = false;
    for (let i = 0; i < 400 && !state.players[0]!.grounded; i += 1) {
      const near = 320 - state.players[0]!.y < 40;
      stepGame(state, near && !pressed ? keys("Space") : keys(), dt);
      if (near) pressed = true;
    }
    const jumpsBefore = state.players[0]!.jumpCount;
    stepFor(state, 0.2);
    expect(state.dive.motions.p0?.phase === "windup").toBe(false);
    expect(state.players[0]!.jumpCount).toBeGreaterThanOrEqual(jumpsBefore);
  });

  it("should hit like a fire dive when a jump dive strikes a rival", () => {
    const state = createGameState({
      level: {
        ...level,
        spawns: [
          { x: 300, y: 320 },
          { x: 362, y: 320 },
        ],
      },
      tunables: DEFAULT_GAME_TUNABLES,
    });
    stepFor(state, 1);
    state.combat.fighters.get("p0")!.weapon = { itemId: "rocket-launcher", ammo: 6 };
    stepFor(state, 0.05, keys("Space"));
    stepFor(state, 0.03);
    const hits = [];
    stepGame(state, keys("Space", "KeyD", "KeyS"), dt);
    for (let i = 0; i < 90 && hits.length === 0; i += 1) {
      stepGame(state, keys(), dt);
      hits.push(...state.dive.hits);
    }
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ attackerSlot: 0, victimSlot: 1, source: "dive" });
    expect(hits[0]!.damage).toBeGreaterThan(0);
    // The ricochet pops the attacker up with the dive ready again.
    expect(state.players[0]!.vy).toBeLessThan(0);
    expect(state.dive.motions.p0?.charged).toBe(true);
  });
});

describe("gameSim — roll carry into a dive (double-jump-bash D12, D13)", () => {
  /** Player 1 rolling along the floor at `speed` (fire held), unlocked; null = standing. */
  const travelled = (speed: number | null): number => {
    const state = newGame();
    stepFor(state, 1);
    const player = state.players[0]!;
    if (speed !== null) {
      player.rollSource = "dash";
      player.rollHoldButton = "fire";
      player.vx = speed;
    }
    stepGame(state, keys("KeyF", "KeyD"), dt);
    stepFor(state, DEFAULT_GAME_TUNABLES.dive.windupSeconds);
    const from = player.x;
    stepFor(state, DEFAULT_GAME_TUNABLES.dive.travelSeconds - dt);
    return player.x - from;
  };

  it("should dive clearly farther out of a fast roll than from standing", () => {
    expect(travelled(1150)).toBeGreaterThan(travelled(null) * 1.25);
  });

  it("should cap the dive's carried speed", () => {
    const d = DEFAULT_GAME_TUNABLES.dive;
    expect(travelled(3000)).toBeLessThanOrEqual(d.rollCarryMax * d.travelSeconds + 1);
  });

  it("should not dive out of a roll that is still locked by a hit", () => {
    const state = newGame();
    stepFor(state, 1);
    const player = state.players[0]!;
    player.rollSource = "hit";
    player.rollLockSeconds = 1;
    stepGame(state, keys("KeyF", "KeyD"), dt);
    stepFor(state, 0.1);
    expect(state.dive.motions.p0?.phase ?? "idle").toBe("idle");
  });
});

/**
 * Routes a built-in level is designed around, run in the real sim. Bobsled Run's last gap must
 * need the roll (owner, bobsled-run-roll): a running jump + late dive falls short, a roll down the
 * ice chute and a jump + dive out of it lands on the crown.
 */
type RouteGame = ReturnType<typeof createGameState>;

const loadLevel = (file: string): LevelDefinition => {
  const result = parseLevelFile(readFileSync(`public/levels/${file}`, "utf8"));
  if (!result.ok) throw new Error(`${file} does not import`);
  return result.level;
};

const bobsled = loadLevel("bobsled-run.html");
const RUNWAY_EDGE = 1290;
const CROWN = { from: 2100, to: 2380, top: 760 };

/** Player 1 on its spawn, player 2 parked on the far floor out of the way. */
const newRun = (): RouteGame => {
  const game = createGameState({ level: bobsled, tunables: DEFAULT_GAME_TUNABLES });
  stepGame(game, keys(), dt);
  Object.assign(game.players[1]!, { x: 2300, y: 1150, vx: 0, vy: 0 });
  for (let i = 0; i < 60; i += 1) stepGame(game, keys(), dt);
  return game;
};

const onCrown = (game: RouteGame): boolean => {
  const p = game.players[0]!;
  return p.grounded && Math.abs(p.y - CROWN.top) < 2 && p.x >= CROWN.from && p.x <= CROWN.to;
};

/**
 * From the runway edge: jump (held to `releaseAt`), press jump again at `diveAt` for a level dive
 * right, `extra` held throughout (fire keeps a roll going). True if it lands on the crown.
 */
function jumpAndDiveFromEdge(game: RouteGame, plan: { diveAt: number; extra: string[] }): boolean {
  stepGame(game, keys("KeyD", "Space", ...plan.extra), dt);
  for (let t = dt; t < 2.5; t += dt) {
    const press = Math.abs(t - plan.diveAt) < dt / 2;
    const holdJump = t < plan.diveAt - 0.03 && t < 0.6;
    const jump = press || holdJump ? ["Space"] : [];
    stepGame(game, keys("KeyD", ...jump, ...plan.extra), dt);
    if (onCrown(game)) return true;
  }
  return false;
}

describe("level routes — Bobsled Run needs the roll", () => {
  it("should miss the crown with a running jump and a dive at any moment when there is no roll", () => {
    for (let diveAt = 0.5; diveAt <= 1.25; diveAt += 0.05) {
      const game = newRun();
      const p = game.players[0]!;
      Object.assign(p, { x: 1200, y: 700 });
      for (let i = 0; i < 400 && p.x < RUNWAY_EDGE - 6; i += 1) stepGame(game, keys("KeyD"), dt);
      expect(jumpAndDiveFromEdge(game, { diveAt, extra: [] })).toBe(false);
    }
  });

  it("should land on the crown after diving onto the chute, rolling down and jumping out of the roll", () => {
    const game = newRun();
    const p = game.players[0]!;
    // Walk off the tower onto the chute, then dive down along it and hold fire: the dash roll.
    for (let i = 0; i < 300 && p.x < 600; i += 1) stepGame(game, keys("KeyD"), dt);
    stepGame(game, keys("KeyF", "KeyD", "KeyS"), dt);
    for (let i = 0; i < 600 && p.x < RUNWAY_EDGE - 6; i += 1)
      stepGame(game, keys("KeyF", "KeyD"), dt);
    expect(p.rollSource).toBe("dash");
    expect(jumpAndDiveFromEdge(game, { diveAt: 1.0, extra: ["KeyF"] })).toBe(true);
  });
});

/**
 * Headbutt vs direct rocket on the shipped levels (owner, bash-matches-rocket lap: a direct bash
 * pushes exactly like a direct rocket hit). A blob stands on each spawn and is hit from the level's
 * middle side, pushing it toward the near edge: by a headbutt from 70 units, or by a rocket flying
 * level into its middle. Player 1 is the attacker (parked in a corner for the rocket).
 */
type KnockGame = ReturnType<typeof createGameState>;
const SHIPPED_LEVELS = readdirSync("public/levels").map(loadLevel);
/** Fire held this long starts the dive (a grounded headbutt: wind-up, then travel). */
const DIVE_HOLD_STEPS = 30;

/** The level with player 2 settled on spawn `index`, player 1 parked in a corner. */
const standOnSpawn = (level: LevelDefinition, index: number): KnockGame | null => {
  const game = createGameState({ level, tunables: DEFAULT_GAME_TUNABLES });
  stepGame(game, keys(), dt);
  Object.assign(game.players[1]!, { ...level.spawns[index]!, vx: 0, vy: 0 });
  const corner = { x: level.bounds.x + 10, y: level.bounds.y + 10, vx: 0, vy: 0 };
  for (let i = 0; i < 90; i += 1) {
    Object.assign(game.players[0]!, corner);
    stepGame(game, keys(), dt);
  }
  return game.players[1]!.grounded ? game : null;
};

/** Side the victim stands on (+1 right of the level's middle): the headbutt pushes that way. */
const edgeSide = (game: KnockGame): number => {
  const { bounds } = game.arena.level;
  return Math.sign(game.players[1]!.x - (bounds.x + bounds.w / 2)) || 1;
};

/** Puts the attacker 70 units on the middle side, level with the victim, facing it. */
const lineUpHeadbutt = (game: KnockGame, side: number): void => {
  const victim = game.players[1]!;
  Object.assign(game.players[0]!, { x: victim.x - side * 70, y: victim.y, vx: 0, vy: 0 });
};

const headbuttKeys = (side: number) => keys(side > 0 ? "KeyD" : "KeyA", "KeyF");

const victimEliminatedBy = (game: KnockGame): string | null => {
  const event = game.combat.events.find((e) => e.type === "playerEliminated" && e.victimSlot === 1);
  return event?.type === "playerEliminated" ? event.cause : null;
};

/** Furthest the victim got sideways in 3.5 s, or null when it left the map. */
function carryAfter(game: KnockGame, attack: (step: number) => void): number | null {
  const startX = game.players[1]!.x;
  let carry = 0;
  for (let i = 0; i < 3.5 / dt; i += 1) {
    attack(i);
    if (victimEliminatedBy(game)) return null;
    carry = Math.max(carry, Math.abs(game.players[1]!.x - startX));
  }
  return carry;
}

function carryOfOneHeadbutt(game: KnockGame): number | null {
  const side = edgeSide(game);
  lineUpHeadbutt(game, side);
  return carryAfter(game, (i) =>
    stepGame(game, i < DIVE_HOLD_STEPS ? headbuttKeys(side) : keys(), dt)
  );
}

/** A rocket from player 1 flying level into the victim's middle, 40 units out. */
function carryOfOneDirectRocket(game: KnockGame): number | null {
  const side = edgeSide(game);
  const victim = game.players[1]!;
  game.combat.rockets.push({
    id: game.combat.nextEntityId++,
    kind: "rocket",
    targetId: null,
    ownerSlot: 0,
    ownerId: "p0",
    x: victim.x - side * 40,
    y: victim.y - hurtHeight(victim) / 2,
    dirX: side,
    dirY: 0,
    age: 0,
  });
  const { bounds } = game.arena.level;
  return carryAfter(game, () => {
    Object.assign(game.players[0]!, { x: bounds.x + 10, y: bounds.y + 10, vx: 0, vy: 0 });
    stepGame(game, keys(), dt);
  });
}

const everySpawn = (): { level: LevelDefinition; index: number }[] =>
  SHIPPED_LEVELS.flatMap((level) => level.spawns.map((_, index) => ({ level, index })));

describe("gameSim — headbutt vs direct rocket on the shipped levels (bash-matches-rocket lap)", () => {
  it("should push a standing blob as far as a direct rocket hit does when a headbutt hits it", () => {
    const outcomes = everySpawn().flatMap(({ level, index }) => {
      const bashed = standOnSpawn(level, index);
      const shot = standOnSpawn(level, index);
      if (!bashed || !shot) return [];
      return [{ bash: carryOfOneHeadbutt(bashed), rocket: carryOfOneDirectRocket(shot) }];
    });
    const offMap = (pick: "bash" | "rocket"): number =>
      outcomes.filter((o) => o[pick] === null).length;
    const onMap = outcomes.filter((o) => o.bash !== null && o.rocket !== null);
    const average = (pick: "bash" | "rocket"): number =>
      onMap.reduce((sum, o) => sum + (o[pick] ?? 0), 0) / onMap.length;
    // Same spawns off the map, same slide (before: the bash ≈ 65 units at dive.hitPushScale 0.2).
    expect(outcomes.map((o) => o.bash === null)).toEqual(outcomes.map((o) => o.rocket === null));
    expect(offMap("bash")).toBe(offMap("rocket"));
    expect(average("bash")).toBeGreaterThan(average("rocket") * 0.95);
    expect(average("bash")).toBeLessThan(average("rocket") * 1.05);
  });
});

/** Seeded uniform [0, 1) (LCG), so a failing fuzz case replays. */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

type FuzzMotion = NonNullable<LevelDefinition["movers"]>[number]["motion"];

/** A random part (slide, spin or swing; thin to thick, slow to fast) by a wall under a ceiling. */
function fuzzMoverLevel(random: () => number): LevelDefinition {
  const w = 16 + random() * 160;
  const h = 6 + random() * 70;
  const cx = 200 + random() * 300;
  const cy = 180 + random() * 120;
  const periodS = 1 + random() * 3;
  const kinds = ["slide", "spin", "swing"] as const;
  const kind = kinds[Math.floor(random() * kinds.length)]!;
  const motion: FuzzMotion =
    kind === "slide"
      ? {
          kind,
          offset: { x: (random() - 0.5) * 360, y: (random() - 0.5) * 240 },
          periodS,
          phase: 0,
        }
      : kind === "spin"
        ? { kind, direction: 1, periodS, phase: 0 }
        : { kind, degrees: 30 + random() * 150, direction: -1, periodS, phase: 0 };
  const stoneRect = (x: number, y: number, size: { w: number; h: number }) =>
    ({ shape: { type: "rect", x, y, ...size }, materialId: "stone" }) as const;
  return {
    ...level,
    formatVersion: 2,
    terrain: [
      ...level.terrain,
      stoneRect(520 + random() * 80, 120, { w: 32, h: 200 }),
      stoneRect(60, 90 + random() * 50, { w: 680, h: 16 }),
      stoneRect(cx - w / 2, cy - h / 2, { w, h }),
    ],
    spawns: [
      { x: 150 + random() * 150, y: 320 },
      { x: 300 + random() * 200, y: 320 },
    ],
    movers: [
      {
        motion,
        pivot: kind === "slide" ? { x: cx, y: cy } : { x: cx - w / 2 + random() * w, y: cy },
        terrainIndices: [3],
      },
    ],
  };
}

const FUZZ_KEYS = [
  ["KeyA", "KeyD", "KeyW", "Space", "KeyS"],
  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"],
];

/** Overlap the controller's own ground moves can leave (launching off a part's edge); the next step's escape absorbs it. */
const CONTACT_NOISE = 1;

/** How far the escape has to move the player (0 when free; Infinity when trapped). */
function stuckDepth(player: PlayerState, terrain: TerrainGrid): number {
  const copy = structuredClone(player);
  const minScale = DEFAULT_GAME_TUNABLES.player.crushGapFraction;
  const result = escapeSolid(copy, terrain, { minScale });
  if (result === "trapped") return Infinity;
  return Math.hypot(copy.x - player.x, copy.y - player.y);
}

describe("gameSim — never stuck in solid (owner, never-stuck)", () => {
  // Ground truth: the owner's report — a moving part pushed a blob against something and it ended
  // stuck inside the part. Invariant: no player in play ever ends a step inside solid deeper than
  // contact noise, whatever the parts and the inputs do.
  it("should leave no player in play inside terrain or a part when parts push them around", () => {
    const stuck: string[] = [];
    for (let seed = 1; seed <= 60; seed += 1) {
      const random = seededRandom(seed);
      const state = createGameState({
        level: fuzzMoverLevel(random),
        tunables: DEFAULT_GAME_TUNABLES,
      });
      let inputs = keys();
      for (let step = 0; step < 360; step += 1) {
        if (step % 20 === 0) {
          inputs = keys(...FUZZ_KEYS.flatMap((pool) => pool.filter(() => random() < 0.35)));
        }
        stepGame(state, inputs, dt);
        for (const player of playersInPlay(state)) {
          const depth = stuckDepth(player, state.arena.terrain);
          if (depth > CONTACT_NOISE) stuck.push(`seed ${seed} step ${step} ${player.id} ${depth}`);
        }
      }
    }
    expect(stuck).toEqual([]);
  });

  /** A still block (a part with a 30 s spin, so it barely turns) at x 300–380, y 260–320. */
  const blockLevel = (): LevelDefinition => ({
    ...level,
    formatVersion: 2,
    terrain: [
      ...level.terrain,
      { shape: { type: "rect", x: 300, y: 260, w: 80, h: 60 }, materialId: "stone" },
    ],
    movers: [
      {
        motion: { kind: "spin", periodS: 30, phase: 0, direction: 1 },
        pivot: { x: 340, y: 290 },
        terrainIndices: [1],
      },
    ],
  });

  it("should move a player a part left half inside it out to the nearest free side", () => {
    const state = stepGame(
      createGameState({ level: blockLevel(), tunables: DEFAULT_GAME_TUNABLES }),
      keys(),
      dt
    );
    const player = state.players[0]!;
    // Feet on the floor, the body's right half inside the block's left face.
    player.x = 300;
    player.y = 320;
    stepGame(state, keys(), dt);
    expect(state.combat.fighters.get(player.id)?.eliminated).toBe(false);
    expect(stuckDepth(player, state.arena.terrain)).toBe(0);
    expect(player.x).toBeLessThan(300 - 13);
    // And it walks away on its own.
    stepFor(state, 0.3, keys("KeyA"));
    expect(player.x).toBeLessThan(270);
  });

  it("should crush a player with no free spot within a body width", () => {
    const state = stepGame(
      createGameState({ level: blockLevel(), tunables: DEFAULT_GAME_TUNABLES }),
      keys(),
      dt
    );
    const player = state.players[0]!;
    // Deep inside the block: the nearest free spot is more than a body width away.
    player.x = 340;
    player.y = 306;
    stepGame(state, keys(), dt);
    expect(state.combat.events).toContainEqual(
      expect.objectContaining({ type: "playerEliminated", victimSlot: 0, cause: "crush" })
    );
  });
});

describe("gameSim — respawn on purpose (owner, never-stuck)", () => {
  const hold = DEFAULT_GAME_TUNABLES.match.selfRespawnHoldSeconds;

  it("should respawn a player who holds the respawn button for the full hold, as a fall", () => {
    const state = stepGame(newGame(), keys(), dt);
    const player = state.players[0]!;
    stepFor(state, hold + 2 * dt, keys("KeyQ"));
    expect(state.combat.events).toContainEqual(
      expect.objectContaining({ type: "playerEliminated", victimSlot: 0, cause: "self" })
    );
    // Nobody hit it: it costs the fall penalty, like falling off alone (match-rules D1).
    expect(state.rules.scores[0]).toBe(-DEFAULT_GAME_TUNABLES.match.scoring.fallPenalty);
    expect(player.respawnHoldSeconds).toBe(0);
  });

  it("should do nothing when the respawn button is let go before the hold is full", () => {
    const state = stepGame(newGame(), keys(), dt);
    stepFor(state, hold * 0.8, keys("Backspace"));
    stepFor(state, dt, keys());
    stepFor(state, hold * 0.8, keys("Backspace"));
    const eliminated = state.combat.events.some((event) => event.type === "playerEliminated");
    expect(eliminated).toBe(false);
    expect(state.players[1]!.respawnHoldSeconds).toBeGreaterThan(0);
  });

  it("should credit a recent hitter with the kill when a hit player respawns on purpose", () => {
    const state = stepGame(newGame(), keys(), dt);
    const fighter = state.combat.fighters.get("p0")!;
    fighter.lastHitBySlot = 1;
    fighter.lastHitAt = state.timeSeconds;
    stepFor(state, hold + 2 * dt, keys("KeyQ"));
    expect(state.rules.scores[1]).toBe(DEFAULT_GAME_TUNABLES.match.scoring.kill);
    expect(state.rules.scores[0]).toBe(0);
  });
});

describe("gameSim — physics objects", () => {
  const ballLevel: LevelDefinition = {
    ...level,
    settings: { ...level.settings, cellSize: 4 },
    objects: [
      {
        kind: "ball",
        variant: "beach",
        box: { x: 376, y: 272, w: 48, h: 48 },
        seed: 1,
        terrainIndices: [],
      },
    ],
  };
  const newBallGame = () => createGameState({ level: ballLevel, tunables: DEFAULT_GAME_TUNABLES });

  it("should import and run the Beach Court level with its four balls in play when the match runs", () => {
    const text = readFileSync(path.join(process.cwd(), "public/levels/beach-court.html"), "utf8");
    const parsed = parseLevelFile(text);
    if (!parsed.ok) throw new Error("beach-court did not import");
    expect(parsed.warnings).toEqual([]);
    const state = createGameState({ level: parsed.level, tunables: DEFAULT_GAME_TUNABLES });
    stepFor(state, 3);
    expect(state.physicsObjects.objects).toHaveLength(4);
    expect(state.physicsObjects.objects.every((ball) => ball.goneUntil === null)).toBe(true);
    // The ramp ball rolled down off its ramp; the riding ball still rides the platform's height.
    const [ramp, , , riding] = state.physicsObjects.objects;
    expect(ramp!.x).toBeGreaterThan(300);
    expect(riding!.y).toBeLessThan(560);
  });

  it("should spawn the level's ball and keep it resting on the floor when the match runs", () => {
    const state = stepFor(newBallGame(), 1);
    expect(state.physicsObjects.objects).toHaveLength(1);
    expect(state.physicsObjects.objects[0]).toMatchObject({ goneUntil: null, grounded: true });
    expect(state.physicsObjects.objects[0]!.y).toBeCloseTo(296, 0);
  });

  it("should explode a rocket on the ball and knock the ball away when the rocket reaches it", () => {
    const state = stepGame(newBallGame(), keys(), dt);
    state.combat.rockets.push({
      id: 99,
      kind: "rocket",
      targetId: null,
      ownerSlot: 1,
      ownerId: "p1",
      x: 300,
      y: 296,
      dirX: 1,
      dirY: 0,
      age: 0.1,
    });
    stepFor(state, 0.2);
    expect(state.combat.events).toContainEqual(expect.objectContaining({ type: "explosion" }));
    const explosion = state.combat.events.find((event) => event.type === "explosion");
    expect(explosion && "x" in explosion ? explosion.x : 0).toBeLessThan(400);
    expect(state.physicsObjects.objects[0]!.x).toBeGreaterThan(400);
  });
});
