import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel, type LevelData } from "@/features/arena/api/arenaApi";
import { createPlayer, stepPlayers } from "@/features/player/services/playerController";

const level: LevelData = {
  id: "test",
  name: "Test",
  cellSize: 8,
  widthCells: 100,
  heightCells: 50,
  blocks: [
    { x: 0, y: 40, width: 100, height: 4, kind: "solid" },
    { x: 60, y: 30, width: 2, height: 10, kind: "solid" },
  ],
  spawnPoints: [],
  dropPoints: [],
  outOfBounds: { x: 0, y: 0, width: 800, height: 400 },
};

const dt = 1 / 120;
const input = (patch: Partial<PlayerInput>): PlayerInput[] => [
  { ...EMPTY_PLAYER_INPUT, connected: true, ...patch },
];

const run = (steps: number, patch: Partial<PlayerInput>, start = { x: 100, y: 200 }) => {
  const terrain = buildTerrainFromLevel(level);
  const player = createPlayer(0, start, DEFAULT_GAME_TUNABLES);
  for (let i = 0; i < steps; i += 1) {
    stepPlayers({
      players: [player],
      inputs: input(patch),
      terrain,
      tunables: DEFAULT_GAME_TUNABLES,
      dt,
    });
  }
  return player;
};

describe("playerController", () => {
  it("should land on the ground and stay grounded when falling with no input", () => {
    const player = run(240, {});
    expect(player.y).toBe(320);
    expect(player.grounded).toBe(true);
    expect(player.vy).toBe(0);
  });

  it("should stop at a wall instead of passing through when running into it", () => {
    const player = run(600, { moveX: 1 }, { x: 400, y: 320 });
    expect(player.x + player.width / 2).toBe(480);
  });

  it("should leave the ground when jump is pressed while grounded", () => {
    const player = run(120, {});
    stepPlayers({
      players: [player],
      inputs: input({ jump: true }),
      terrain: buildTerrainFromLevel(level),
      tunables: DEFAULT_GAME_TUNABLES,
      dt,
    });
    expect(player.vy).toBeLessThan(0);
    expect(player.y).toBeLessThan(320);
  });
});
