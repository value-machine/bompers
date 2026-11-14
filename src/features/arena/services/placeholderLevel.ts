import type { LevelData } from "@/features/arena/types/arena.types";

/**
 * Placeholder level that proves the level format: a floating main platform (solid base,
 * destructible top) and two destructible plateaus. The starting-arena lap replaces it with the
 * real start map (GDD § 4) in the same format.
 */
export const PLACEHOLDER_LEVEL: LevelData = {
  id: "placeholder",
  name: "Placeholder",
  cellSize: 8,
  widthCells: 160,
  heightCells: 90,
  blocks: [
    { x: 30, y: 62, width: 100, height: 4, kind: "destructible" },
    { x: 34, y: 66, width: 92, height: 4, kind: "solid" },
    { x: 44, y: 42, width: 24, height: 3, kind: "destructible" },
    { x: 92, y: 42, width: 24, height: 3, kind: "destructible" },
  ],
  spawnPoints: [
    { x: 400, y: 496 },
    { x: 880, y: 496 },
    { x: 448, y: 336 },
    { x: 832, y: 336 },
  ],
  dropPoints: [
    { x: 640, y: -40 },
    { x: 448, y: -40 },
    { x: 832, y: -40 },
  ],
  outOfBounds: { x: -320, y: -480, width: 1920, height: 1360 },
};
