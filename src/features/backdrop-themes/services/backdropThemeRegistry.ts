import { toCssColor } from "@/shared/config/gamePalette";
import { LAVA_CAVE_THEME } from "@/features/backdrop-themes/services/lavaCaveTheme";
import { MEADOW_THEME } from "@/features/backdrop-themes/services/meadowTheme";
import { NIGHT_SKY_THEME } from "@/features/backdrop-themes/services/nightSkyTheme";
import { SNOWY_PEAKS_THEME } from "@/features/backdrop-themes/services/snowyPeaksTheme";
import { UNDERWATER_THEME } from "@/features/backdrop-themes/services/underwaterTheme";
import { CITY_ROOFTOPS_THEME } from "@/features/backdrop-themes/services/cityRooftopsTheme";
import type {
  BackdropTheme,
  ExportedBackdropTheme,
} from "@/features/backdrop-themes/types/backdropTheme.types";

/**
 * The theme registry: every backdrop theme a level may pick with `data-theme`, the single source
 * for the importer, the renderer, the kit's catalog.json and the level prompt (level-themes D1).
 * A new theme = one recipe file plus one line here.
 */
export const BACKDROP_THEMES: Readonly<Record<string, BackdropTheme>> = {
  [MEADOW_THEME.id]: MEADOW_THEME,
  [NIGHT_SKY_THEME.id]: NIGHT_SKY_THEME,
  [LAVA_CAVE_THEME.id]: LAVA_CAVE_THEME,
  [SNOWY_PEAKS_THEME.id]: SNOWY_PEAKS_THEME,
  [UNDERWATER_THEME.id]: UNDERWATER_THEME,
  [CITY_ROOFTOPS_THEME.id]: CITY_ROOFTOPS_THEME,
};

/** The theme of a level that names none (or an unknown one). */
export const DEFAULT_BACKDROP_THEME_ID = MEADOW_THEME.id;

export const isBackdropThemeId = (id: string): boolean =>
  Object.prototype.hasOwnProperty.call(BACKDROP_THEMES, id);

/** The theme for an ID; the default theme when the ID is missing or unknown. */
export const resolveBackdropTheme = (id: string | undefined): BackdropTheme =>
  (id !== undefined && isBackdropThemeId(id) ? BACKDROP_THEMES[id] : undefined) ?? MEADOW_THEME;

/** Plain JSON copy of the registry (catalog.json `theme`). */
export const exportBackdropThemes = (): ExportedBackdropTheme[] =>
  Object.values(BACKDROP_THEMES).map(({ id, label, description, sky }) => ({
    id,
    label,
    description,
    sky: { top: toCssColor(sky.top), bottom: toCssColor(sky.bottom) },
  }));
