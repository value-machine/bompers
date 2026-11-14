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
  /** Player body colour per slot 0–3 (DESIGN_LANGUAGE § 1: tomato, cobalt, lemon, mint). */
  players: [0xff4f3a, 0x3069ff, 0xffd43b, 0x2ed0a0],
  /** Darker crescent / feet per slot (body mixed 38 % toward ink). */
  playerShades: [0xae3c3a, 0x2e4cb4, 0xae8e3b, 0x2d8c79],
  /** Light tint per slot (body mixed 45 % toward white). */
  playerTints: [0xff9e93, 0x8dadff, 0xffe793, 0x8ce5cb],
  /** The only outline colour; also pupils and contact shadows. */
  ink: 0x2b1d3a,
  /** Helmet shell, same for every player. */
  helmet: 0xfff4e2,
  eyeWhite: 0xffffff,
  gloss: 0xffffff,
} as const;
