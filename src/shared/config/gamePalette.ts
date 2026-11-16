/**
 * Canvas palette (numeric 0xRRGGBB, the format Pixi takes). Values come from
 * `documentation/game/DESIGN_LANGUAGE.md` § 1 (Gumdrop Pop), which is their source; change them
 * there first. The one place game colors live; do not inline colors elsewhere.
 * Player arrays are indexed by slot (0–3).
 */
/** One terrain colour (catalog `color` kind): slab body, lighter top lip, darker seams. */
export interface TerrainSwatch {
  fill: number;
  lip: number;
  /** Breakable seam grid and pips, and debris edges. */
  seam: number;
}

export const GAME_PALETTE = {
  /** The only outline color; also HUD text. */
  ink: 0x2b1d3a,
  helmet: 0xfff4e2,
  /** Rocket-tube cap and helmet shading edge: shell mixed 28 % toward ink (mockup variant E). */
  helmetEdge: 0xc4b8b3,
  /** Bottom of the helmet gradient: shell mixed 10 % toward ink (DESIGN_LANGUAGE § 3). */
  helmetShade: 0xeadfd1,
  /** Eye whites (pupils are ink). */
  eyeWhite: 0xffffff,
  /** Gloss oval on bodies and the helmet gloss stroke. */
  gloss: 0xffffff,
  /** Body colors P1–P4: tomato, cobalt, lemon, mint. */
  players: [0xff4f3a, 0x3069ff, 0xffd43b, 0x2ed0a0],
  /** Darker crescent: body mixed 38 % toward ink. */
  playerShades: [0xae3c3a, 0x2e4cb4, 0xae8e3b, 0x2d8c79],
  /** Gloss / UI fills: body mixed 45 % toward white. */
  playerTints: [0xff9e93, 0x8dadff, 0xffe793, 0x8ce5cb],
  /** Effects (DESIGN_LANGUAGE § 1 Effects). Rocket fins use the shooter's body colour. */
  explosion: { outer: 0xff8a1f, mid: 0xffe14d, core: 0xffffff },
  rocket: { body: 0xfff4e2, nose: 0x2b1d3a, flame: 0xffb21a, tubeCap: 0xd9c7ae },
  pickupCrate: 0xfff4e2,
  pickupRing: 0x8fd6ff,
  /** Lost health chunk (DESIGN_LANGUAGE § 7). */
  healthLost: 0xe9dfd0,
  /** Point orb: bubblegum star (DESIGN_LANGUAGE § 1 Effects). */
  pointOrb: 0xff8fc8,
  /** HUD cards (DESIGN_LANGUAGE § 7): card fill, caption text, timer numerals. */
  hud: { card: 0xfffaf0, caption: 0x8a7a99, timer: 0xffd43b },
  sky: { top: 0x8fd6ff, bottom: 0xfff1cf },
  /** Backdrop (DESIGN_LANGUAGE § 1 World): sun disc, clouds with a soft edge, two hill bands. */
  backdrop: {
    sun: 0xfff6a8,
    cloud: 0xffffff,
    cloudEdge: 0xbfe3f5,
    hillsFar: 0xbfe8d0,
    hillsNear: 0x9fd8b8,
  },
  /** Crack next to a crater. */
  crack: 0x2b1d3a,
  /** Ice surface cue: gloss streaks and the inner rim (DESIGN_LANGUAGE § 2). */
  iceGloss: 0xffffff,
  /** Rocket smoke puffs. */
  smoke: 0xffffff,
  timerWarning: 0xff8a1f,
  /** Hit feedback (DESIGN_LANGUAGE § 1 Effects): hit flash, and the explosion mid star for strong hits. */
  hitFlash: 0xffffff,
  hitStrong: 0xffe14d,
  /** Keyed by a catalog `color` ID (DESIGN_LANGUAGE § 1 Terrain swatches). */
  terrainSwatches: {
    plum: { fill: 0x5a3f7a, lip: 0x7d5fa6, seam: 0x3e2a56 },
    slate: { fill: 0x4f6178, lip: 0x71849c, seam: 0x36445a },
    cardboard: { fill: 0xc99a62, lip: 0xddb682, seam: 0x8f6636 },
    clay: { fill: 0xc4673f, lip: 0xdc8a62, seam: 0x8c4426 },
    moss: { fill: 0x5f8f3e, lip: 0x82b05c, seam: 0x3f6427 },
    mint: { fill: 0x3aa889, lip: 0x67c7aa, seam: 0x247a62 },
    frost: { fill: 0xa8cfe6, lip: 0xdff1fa, seam: 0x6b97b8 },
    rose: { fill: 0xc95a86, lip: 0xe384a8, seam: 0x8f3a5d },
  } as Readonly<Record<string, TerrainSwatch>>,
  /** Swatch for a colour ID with no entry (should not happen after normalisation). */
  fallbackSwatch: { fill: 0x5a3f7a, lip: 0x7d5fa6, seam: 0x3e2a56 } as TerrainSwatch,
} as const;

/** A palette colour as CSS, for DOM next to the canvas (hints, lobby blobs). */
/** The swatch of a terrain colour ID. */
export const terrainSwatch = (colorId: string): TerrainSwatch =>
  GAME_PALETTE.terrainSwatches[colorId] ?? GAME_PALETTE.fallbackSwatch;

export const toCssColor = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
