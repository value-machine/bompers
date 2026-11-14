import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { applyHit } from "@/features/combat/api/combatApi";
import { createGameState, stepGame } from "@/features/match/services/gameSim";

const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "t", title: "T" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 800, h: 400 },
  terrain: [
    { shape: { type: "rect", x: 0, y: 320, w: 800, h: 32 }, role: "platform", materialId: "stone" },
  ],
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
            role: "platform",
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
