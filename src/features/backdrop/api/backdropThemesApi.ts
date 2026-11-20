/**
 * Public seam of the theme registry, apart from the renderer so the importer, thumbnails and the
 * level kit read the themes without loading Pixi.
 */
export {
  BACKDROP_THEMES,
  DEFAULT_BACKDROP_THEME_ID,
  exportBackdropThemes,
  isBackdropThemeId,
  resolveBackdropTheme,
} from "@/features/backdrop/services/backdropThemeRegistry";
export type {
  BackdropTheme,
  ExportedBackdropTheme,
} from "@/features/backdrop/types/backdropTheme.types";
