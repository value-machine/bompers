import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop-themes/types/backdropTheme.types";

const LAVA = GAME_PALETTE.backdropThemes.lavaCave;

/** A dark cave glowing orange from below: stalactites overhead, rock spires, rising embers. */
export const LAVA_CAVE_THEME: BackdropTheme = {
  id: "lava-cave",
  label: "Lava cave",
  description: "Dark cave glowing orange from below, stalactites, rock spires, rising embers.",
  sky: LAVA.sky,
  disc: null,
  ceiling: { color: LAVA.ceiling, period: 600, depth: 120, parallax: 0.15 },
  far: {
    shape: "spires",
    color: LAVA.spiresFar,
    period: 840,
    amplitude: 120,
    parallax: 0.2,
    base: 0.62,
  },
  near: {
    shape: "rocks",
    color: LAVA.rocksNear,
    period: 680,
    amplitude: 50,
    parallax: 0.4,
    base: 0.76,
  },
  clouds: null,
  ambient: { kind: "embers", count: 36, colors: LAVA.embers },
  light: { tint: 0xff9a5a, strength: 0 },
};
