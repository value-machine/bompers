/** Public seam of the content catalog: ID lookup with fallback, defaults, and the JSON export. */
export type {
  BehaviorEntry,
  CatalogDefaults,
  ColorEntry,
  CatalogEntryByKind,
  ContentCatalog,
  ContentKind,
  EffectEntry,
  ExportedCatalog,
  ItemEntry,
  MaterialEntry,
  MaterialSurface,
  ResolvedEntry,
  SoundEntry,
} from "@/features/content-catalog/types/contentCatalog.types";
export {
  CATALOG_DEFAULTS,
  CONTENT_CATALOG,
  FALLBACK_IDS,
  LEVEL_FORMAT_VERSION,
  exportCatalog,
  hasCatalogEntry,
  resolveCatalogEntry,
} from "@/features/content-catalog/services/contentCatalog";
