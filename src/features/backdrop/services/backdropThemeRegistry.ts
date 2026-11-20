import { toCssColor } from "@/shared/config/gamePalette";
import { LAVA_CAVE_THEME } from "@/features/backdrop/services/lavaCaveTheme";
import { MEADOW_THEME } from "@/features/backdrop/services/meadowTheme";
import { NIGHT_SKY_THEME } from "@/features/backdrop/services/nightSkyTheme";
import { SNOWY_PEAKS_THEME } from "@/features/backdrop/services/snowyPeaksTheme";
import type {
  BackdropTheme,
  ExportedBackdropTheme,
} from "@/features/backdrop/types/backdropTheme.types";

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
