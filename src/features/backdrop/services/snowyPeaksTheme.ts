import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop/types/backdropTheme.types";

const SNOW = GAME_PALETTE.backdropThemes.snowyPeaks;

/** Pale winter sky over snow-capped mountains, with slow falling snow. */
export const SNOWY_PEAKS_THEME: BackdropTheme = {
  id: "snowy-peaks",
  label: "Snowy peaks",
  description: "Pale winter sky, snow-capped mountains, slow falling snow.",
  sky: SNOW.sky,
  disc: { kind: "sun", color: SNOW.sun, at: { x: 0.18, y: 0.16 }, radius: 40 },
  ceiling: null,
  far: {
    shape: "peaks",
    color: SNOW.peaksFar,
    capColor: SNOW.capsFar,
    period: 900,
    amplitude: 130,
    parallax: 0.2,
    base: 0.58,
  },
  near: {
    shape: "peaks",
    color: SNOW.peaksNear,
    capColor: SNOW.capsNear,
    period: 620,
    amplitude: 70,
    parallax: 0.4,
    base: 0.72,
  },
  clouds: null,
  ambient: { kind: "snow", count: 48, colors: SNOW.snow },
  light: { tint: 0xcfe6ff, strength: 0 },
};
