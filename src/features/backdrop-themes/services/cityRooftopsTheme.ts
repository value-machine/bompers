import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop-themes/types/backdropTheme.types";

const CITY = GAME_PALETTE.backdropThemes.cityRooftops;

/** Dusk over a skyline with lit windows, pink clouds and chimneyed roofs up close. */
export const CITY_ROOFTOPS_THEME: BackdropTheme = {
  id: "city-rooftops",
  label: "City rooftops",
  description: "Dusk over a skyline with lit windows, pink clouds, chimneys up close.",
  sky: CITY.sky,
  disc: { kind: "sun", color: CITY.sun, at: { x: 0.28, y: 0.4 }, radius: 64 },
  ceiling: null,
  far: {
    shape: "skyline",
    color: CITY.skylineFar,
    accentColor: CITY.windows,
    period: 840,
    amplitude: 120,
    parallax: 0.2,
    base: 0.6,
  },
  near: {
    shape: "roofs",
    color: CITY.roofsNear,
    period: 720,
    amplitude: 70,
    parallax: 0.4,
    base: 0.76,
  },
  clouds: { color: CITY.cloud, edge: CITY.cloudEdge },
  ambient: null,
  light: { tint: 0xffb38a, strength: 0 },
};
