/** Public seam of the content catalog: ID lookup with fallback, and the JSON export. */
export type {
  BehaviorEntry,
  CatalogEntryByKind,
  ContentCatalog,
  ContentKind,
  EffectEntry,
  ExportedCatalog,
  ItemEntry,
  MaterialEntry,
  ResolvedEntry,
  SoundEntry,
} from "@/features/content-catalog/types/contentCatalog.types";
export {
  CATALOG_VERSION,
  CONTENT_CATALOG,
  FALLBACK_IDS,
  exportCatalog,
  hasCatalogEntry,
  resolveCatalogEntry,
} from "@/features/content-catalog/services/contentCatalog";
