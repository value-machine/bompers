/**
 * Canvas palette (numeric 0xRRGGBB, the format Pixi takes). Values come from
 * `documentation/game/DESIGN_LANGUAGE.md` § 1 (Gumdrop Pop), which is their source; change them
 * there first. The one place game colors live; do not inline colors elsewhere.
 */
interface PlayerColors {
  body: number;
  /** Darker crescent: body mixed 38 % toward ink. */
  shade: number;
  /** Gloss / UI fills: body mixed 45 % toward white. */
  tint: number;
}

interface MaterialLook {
  fill: number;
  /** Top lip (stone) or alternate cell (destructible). */
  accent: number;
}

const PLAYERS: readonly PlayerColors[] = [
  { body: 0xff4f3a, shade: 0xae3c3a, tint: 0xff9e93 },
  { body: 0x3069ff, shade: 0x2e4cb4, tint: 0x8dadff },
  { body: 0xffd43b, shade: 0xae8e3b, tint: 0xffe793 },
  { body: 0x2ed0a0, shade: 0x2d8c79, tint: 0x8ce5cb },
];

export const GAME_PALETTE = {
  /** The only outline color; also HUD text. */
  ink: 0x2b1d3a,
  sky: { top: 0x8fd6ff, bottom: 0xfff1cf },
  helmet: 0xfff4e2,
  timerWarning: 0xff8a1f,
  /** One entry per player slot (0–3). */
  players: PLAYERS,
  /** Keyed by a catalog material's `lookToken`. */
  materialLooks: {
    stone: { fill: 0x5a3f7a, accent: 0x7d5fa6 },
    dirt: { fill: 0xf4ad55, accent: 0xf7bd6c },
  } as Readonly<Record<string, MaterialLook>>,
  /** Look for a lookToken with no entry (should not happen after normalisation). */
  fallbackLook: { fill: 0x5a3f7a, accent: 0x7d5fa6 } as MaterialLook,
} as const;

/** Colors for a player slot (wraps past 4). */
export const playerColors = (slot: number): PlayerColors =>
  PLAYERS[((slot % PLAYERS.length) + PLAYERS.length) % PLAYERS.length] ?? PLAYERS[0]!;
