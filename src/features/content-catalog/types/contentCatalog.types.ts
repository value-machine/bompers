/**
 * Content catalog types: the IDs a level may reference. Every entry is plain, JSON-serialisable
 * data keyed by a stable kebab-case ID; field names match the level kit's catalog.json
 * (documentation/game/LEVEL_FORMAT.md § 6, § 9) so the kit file is generated from code.
 */
export type ContentKind = "material" | "effect" | "sound" | "behavior" | "item";

interface CatalogEntryBase {
  id: string;
  /** Human-readable name for level authors. */
  label: string;
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
  /** Default effect ID when cells are destroyed (a shape's data-effect overrides it). */
  effect: string;
  /** Default sound ID when cells are hit or destroyed (a shape's data-sound overrides it). */
  sound: string;
}

export type EffectEntry = CatalogEntryBase;
export type SoundEntry = CatalogEntryBase;
export type BehaviorEntry = CatalogEntryBase;

export interface ItemEntry extends CatalogEntryBase {
  /** Where the item appears: from drop points, or as a collectible. */
  use: "drop" | "collectible";
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

/** Defaults a level falls back to (catalog.json `defaults`). */
export interface CatalogDefaults {
  cellSize: number;
  gravity: number;
  /** Seconds. */
  matchDuration: number;
  material: { platform: string; destructible: string };
  items: { drop: string[]; collectible: string };
}

/** Result of resolving an ID: `isFallback` is true when the ID was unknown. */
export interface ResolvedEntry<K extends ContentKind> {
  entry: CatalogEntryByKind[K] | null;
  isFallback: boolean;
}

/** Plain-JSON export: the shape of the level kit's catalog.json. */
export type ExportedCatalog = {
  formatVersion: number;
  defaults: CatalogDefaults;
} & { [K in ContentKind]: CatalogEntryByKind[K][] };
