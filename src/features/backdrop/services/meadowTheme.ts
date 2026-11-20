import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop/types/backdropTheme.types";

/** The default theme: the sunny meadow every level had before themes (DESIGN_LANGUAGE § 1 World). */
export const MEADOW_THEME: BackdropTheme = {
  id: "meadow",
  label: "Sunny meadow",
  description: "Sunny sky, drifting clouds, soft green hills (the default).",
  sky: GAME_PALETTE.sky,
  disc: { kind: "sun", color: GAME_PALETTE.backdrop.sun, at: { x: 0.82, y: 0.16 }, radius: 56 },
  ceiling: null,
  far: {
    shape: "hills",
    color: GAME_PALETTE.backdrop.hillsFar,
    period: 960,
    amplitude: 70,
    parallax: 0.2,
    base: 0.56,
  },
  near: {
    shape: "hills",
    color: GAME_PALETTE.backdrop.hillsNear,
    period: 720,
    amplitude: 46,
    parallax: 0.4,
    base: 0.7,
  },
  clouds: { color: GAME_PALETTE.backdrop.cloud, edge: GAME_PALETTE.backdrop.cloudEdge },
  ambient: null,
  light: { tint: 0xffffff, strength: 0 },
};
