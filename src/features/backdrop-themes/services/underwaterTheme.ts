import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { BackdropTheme } from "@/features/backdrop-themes/types/backdropTheme.types";

const SEA = GAME_PALETTE.backdropThemes.underwater;

/** Sunlit water fading to deep blue: rocks far off, swaying kelp up close, bubbles rising. */
export const UNDERWATER_THEME: BackdropTheme = {
  id: "underwater",
  label: "Underwater",
  description: "Sunlit water fading to deep blue, rocks and kelp, bubbles rising.",
  sky: SEA.sky,
  disc: null,
  ceiling: null,
  far: {
    shape: "rocks",
    color: SEA.rocksFar,
    period: 920,
    amplitude: 70,
    parallax: 0.2,
    base: 0.62,
  },
  near: {
    shape: "kelp",
    color: SEA.kelpNear,
    period: 760,
    amplitude: 44,
    parallax: 0.4,
    base: 0.78,
  },
  clouds: null,
  ambient: { kind: "bubbles", count: 28, colors: SEA.bubbles },
  light: { tint: 0x5fe0ff, strength: 0 },
};
