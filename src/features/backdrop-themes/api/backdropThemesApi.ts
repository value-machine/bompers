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
} from "@/features/backdrop-themes/services/backdropThemeRegistry";
export type {
  BackdropAmbient,
  BackdropAmbientKind,
  BackdropBand,
  BackdropCeiling,
  BackdropDisc,
  BackdropTheme,
  ExportedBackdropTheme,
} from "@/features/backdrop-themes/types/backdropTheme.types";
