/**
 * Canvas palette (numeric 0xRRGGBB, the format Pixi takes). Values come from
 * `documentation/game/DESIGN_LANGUAGE.md` § 1 (Gumdrop Pop), which is their source; change them
 * there first. The one place game colors live; do not inline colors elsewhere.
 * Player arrays are indexed by slot (0–3).
 */
interface MaterialLook {
  fill: number;
  /** Top lip (stone) or alternate cell (destructible). */
  accent: number;
}

export const GAME_PALETTE = {
  /** The only outline color; also HUD text. */
  ink: 0x2b1d3a,
  helmet: 0xfff4e2,
  /** Body colors P1–P4: tomato, cobalt, lemon, mint. */
  players: [0xff4f3a, 0x3069ff, 0xffd43b, 0x2ed0a0],
  /** Darker crescent: body mixed 38 % toward ink. */
  playerShades: [0xae3c3a, 0x2e4cb4, 0xae8e3b, 0x2d8c79],
  /** Gloss / UI fills: body mixed 45 % toward white. */
  playerTints: [0xff9e93, 0x8dadff, 0xffe793, 0x8ce5cb],
  sky: { top: 0x8fd6ff, bottom: 0xfff1cf },
  timerWarning: 0xff8a1f,
  /** Keyed by a catalog material's `lookToken`. */
  materialLooks: {
    stone: { fill: 0x5a3f7a, accent: 0x7d5fa6 },
    dirt: { fill: 0xf4ad55, accent: 0xf7bd6c },
  } as Readonly<Record<string, MaterialLook>>,
  /** Look for a lookToken with no entry (should not happen after normalisation). */
  fallbackLook: { fill: 0x5a3f7a, accent: 0x7d5fa6 } as MaterialLook,
} as const;
