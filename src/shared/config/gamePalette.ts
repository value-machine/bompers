/**
 * Placeholder palette for the Pixi canvas (numeric 0xRRGGBB, the format Pixi takes).
 *
 * The one place game colors live until the design-language task replaces these values with
 * its theme; the canvas cannot read CSS tokens directly. Do not inline colors elsewhere.
 */
export const GAME_PALETTE = {
  background: 0x1b1d2a,
  terrainSolid: 0x5b6078,
  terrainDestructible: 0xb98a5a,
  outOfBounds: 0x2a2d3f,
  hudText: 0xf2f2f2,
  /** One color per player slot (0–3). */
  players: [0xff5a5f, 0x3fa7ff, 0x5ed16a, 0xffc93c],
} as const;
