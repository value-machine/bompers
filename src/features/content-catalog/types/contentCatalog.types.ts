/**
 * Content catalog types: the IDs a level may reference. Every entry is plain, JSON-serialisable
 * data keyed by a stable kebab-case ID, so the level kit can ship the catalog as catalog.json.
 */
export type ContentKind = "material" | "effect" | "sound" | "behavior" | "item";

interface CatalogEntryBase {
  id: string;
  /** Human-readable name for level authors. */
  name: string;
  description: string;
}

/** What a terrain shape is made of: how it behaves, looks and sounds. */
export interface MaterialEntry extends CatalogEntryBase {
  /** Blasts can clear it (only when the shape's role is also "destructible"). */
  destructible: boolean;
  /** Hits to clear one cell (1 = one blast). Used by combat later. */
  durability: number;
  /** 0 = ice … 1 = grippy. Used by the player controller later. */
  friction: number;
  /** 0 = dead stop … 1 = full bounce. */
  bounce: number;
  /** Key into the game palette's material looks. */
  lookToken: string;
  /** Default sound / effect IDs when a shape doesn't set its own. */
  impactSoundId: string;
  destroySoundId: string;
  destroyEffectId: string;
}

export type EffectEntry = CatalogEntryBase;
export type SoundEntry = CatalogEntryBase;
export type BehaviorEntry = CatalogEntryBase;

export interface ItemEntry extends CatalogEntryBase {
  /** "pickup": weapon / power-up from drops; "collectible": points. */
  category: "pickup" | "collectible";
}

export interface CatalogEntryByKind {
  material: MaterialEntry;
  effect: EffectEntry;
  sound: SoundEntry;
  behavior: BehaviorEntry;
  item: ItemEntry;
}

export type ContentCatalog = {
  [K in ContentKind]: Readonly<Record<string, CatalogEntryByKind[K]>>;
};

/** Result of resolving an ID: `fallback` is true when the ID was unknown. */
export interface ResolvedEntry<K extends ContentKind> {
  entry: CatalogEntryByKind[K] | null;
  fallback: boolean;
}

/** Plain-JSON export (catalog.json of the level kit). */
export interface ExportedCatalog {
  catalogVersion: number;
  fallbackIds: Record<ContentKind, string | null>;
  entries: { [K in ContentKind]: CatalogEntryByKind[K][] };
}
