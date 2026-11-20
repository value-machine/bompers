/**
 * A backdrop theme (level-themes D1): everything the picture behind the arena needs, picked by a
 * level with one root attribute, `data-theme`. Colours are numeric 0xRRGGBB from `GAME_PALETTE`.
 * One recipe file per theme plus one registry line (`backdropThemeRegistry.ts`); IDs are never
 * renamed or reused once shipped.
 */

/**
 * Silhouette of a tiled band: rolling hills, snow-capped peaks, pointed spires, jagged rocks,
 * rocks with swaying kelp stalks, a city skyline, pitched roofs with chimneys.
 */
export type BackdropBandShape =
  | "hills"
  | "peaks"
  | "spires"
  | "rocks"
  | "kelp"
  | "skyline"
  | "roofs";

export interface BackdropBand {
  shape: BackdropBandShape;
  color: number;
  /** Detail colour: snow caps on `peaks`, lit windows on `skyline`. */
  accentColor?: number;
  /** Width of one baked tile (px). */
  period: number;
  /** Bump height (px); the tile is twice this tall. */
  amplitude: number;
  parallax: number;
  /** Baseline as a fraction of the screen height. */
  base: number;
}

/** A band hanging from the top of the screen (cave stalactites). */
export interface BackdropCeiling {
  color: number;
  period: number;
  /** Longest drip (px). */
  depth: number;
  parallax: number;
}

export interface BackdropDisc {
  kind: "sun" | "moon";
  color: number;
  /** Moon craters. */
  craterColor?: number;
  /** Centre as fractions of the screen. */
  at: { x: number; y: number };
  radius: number;
}

export type BackdropAmbientKind = "stars" | "snow" | "embers" | "bubbles";

/** Screen-space particles, drawn behind the world (never over players). */
export interface BackdropAmbient {
  kind: BackdropAmbientKind;
  count: number;
  /** Picked per particle in turn. */
  colors: readonly number[];
}

export interface BackdropTheme {
  id: string;
  label: string;
  /** One line for the level prompt and the kit catalog. */
  description: string;
  sky: { top: number; bottom: number };
  disc: BackdropDisc | null;
  ceiling: BackdropCeiling | null;
  far: BackdropBand;
  near: BackdropBand;
  clouds: { color: number; edge: number } | null;
  ambient: BackdropAmbient | null;
  /**
   * Reserved for scene lighting (level-themes D3): a tint and its strength. Nothing reads it yet;
   * every theme ships with strength 0.
   */
  light: { tint: number; strength: number };
}

/** catalog.json `theme` entry (colours as CSS hex). */
export interface ExportedBackdropTheme {
  id: string;
  label: string;
  description: string;
  sky: { top: string; bottom: string };
}
