import type { LevelDefinition } from "@/features/level/types/levelDefinition.types";

/**
 * Placeholder start map proving the level model: a floating main platform (stone base, dirt
 * top) and two dirt plateaus. The starting-arena lap replaces it with the first HTML level file.
 */
export const PLACEHOLDER_LEVEL: LevelDefinition = {
  formatVersion: 1,
  meta: {
    levelId: "placeholder",
    title: "Placeholder",
    description: "Engine-foundation test map.",
  },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 1280, h: 720 },
  terrain: [
    {
      shape: { type: "rect", x: 240, y: 496, w: 800, h: 32 },
      role: "destructible",
      materialId: "dirt",
    },
    {
      shape: { type: "rect", x: 272, y: 528, w: 736, h: 32 },
      role: "platform",
      materialId: "stone",
    },
    {
      shape: { type: "rect", x: 352, y: 336, w: 192, h: 24 },
      role: "destructible",
      materialId: "dirt",
    },
    {
      shape: { type: "rect", x: 736, y: 336, w: 192, h: 24 },
      role: "destructible",
      materialId: "dirt",
    },
  ],
  spawns: [
    { x: 400, y: 496 },
    { x: 880, y: 496 },
    { x: 448, y: 336 },
    { x: 832, y: 336 },
  ],
  drops: [
    { at: { x: 640, y: -40 }, itemIds: ["rocket-launcher"] },
    { at: { x: 448, y: -40 }, itemIds: ["rocket-launcher"] },
    { at: { x: 832, y: -40 }, itemIds: ["rocket-launcher"] },
  ],
  // Point orbs hover over the plateaus and the middle of the main platform.
  collectibles: [
    { at: { x: 640, y: 440 }, itemId: "point-orb" },
    { at: { x: 448, y: 296 }, itemId: "point-orb" },
    { at: { x: 832, y: 296 }, itemId: "point-orb" },
  ],
  bounds: { x: -320, y: -480, w: 1920, h: 1360 },
};
