import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop-themes/types/backdropTheme.types";

const NIGHT = GAME_PALETTE.backdropThemes.nightSky;

/** Deep violet night: a cream moon, twinkling stars, dark rolling hills. */
export const NIGHT_SKY_THEME: BackdropTheme = {
  id: "night-sky",
  label: "Night sky",
  description: "Violet night sky, a cream moon, twinkling stars, dark hills.",
  sky: NIGHT.sky,
  disc: {
    kind: "moon",
    color: NIGHT.moon,
    craterColor: NIGHT.moonCrater,
    at: { x: 0.8, y: 0.18 },
    radius: 44,
  },
  ceiling: null,
  far: {
    shape: "hills",
    color: NIGHT.hillsFar,
    period: 1040,
    amplitude: 60,
    parallax: 0.2,
    base: 0.6,
  },
  near: {
    shape: "hills",
    color: NIGHT.hillsNear,
    period: 800,
    amplitude: 40,
    parallax: 0.4,
    base: 0.74,
  },
  clouds: null,
  ambient: { kind: "stars", count: 44, colors: NIGHT.stars },
  light: { tint: 0x8f86ff, strength: 0 },
};
