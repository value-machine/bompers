import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { mapPlayerInputs } from "@/shared/utils/gameInputMapping";
import type { LevelData } from "@/features/arena/api/arenaApi";
import { createGameState, stepGame } from "@/features/match/services/gameSim";

const level: LevelData = {
  id: "test",
  name: "Test",
  cellSize: 8,
  widthCells: 100,
  heightCells: 50,
  blocks: [{ x: 0, y: 40, width: 100, height: 4, kind: "solid" }],
  spawnPoints: [
    { x: 100, y: 200 },
    { x: 600, y: 200 },
  ],
  dropPoints: [],
  outOfBounds: { x: -100, y: -100, width: 1000, height: 600 },
};

const dt = 1 / 120;
const keys = (...codes: string[]) => mapPlayerInputs({ heldKeys: new Set(codes), gamepads: [] });
const newGame = (durationSeconds = 180) =>
  createGameState({
    level,
    tunables: {
      ...DEFAULT_GAME_TUNABLES,
      match: { ...DEFAULT_GAME_TUNABLES.match, durationSeconds },
    },
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
    stepGame(state, keys(), dt);
    expect(player.y).toBeLessThan(250);
  });

  it("should end the round and freeze players when the timer runs out", () => {
    const state = newGame(1);
    for (let i = 0; i < 130; i += 1) stepGame(state, keys(), dt);
    expect(state.round).toEqual({ phase: "ended", remainingSeconds: 0 });
    const frozenX = state.players[0]!.x;
    stepGame(state, keys("KeyD"), dt);
    expect(state.players[0]!.x).toBe(frozenX);
  });
});
