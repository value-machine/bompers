/**
 * Content catalog types: the IDs a level may reference. Every entry is plain, JSON-serialisable
 * data keyed by a stable kebab-case ID; field names match the level kit's catalog.json
 * (documentation/game/LEVEL_FORMAT.md § 6, § 9) so the kit file is generated from code.
 */
import type { MaterialReactions } from "@/shared/types/element.types";
import type { MaterialSurface } from "@/shared/types/terrainSurface.types";

export type { MaterialSurface };

export type ContentKind = "material" | "color" | "effect" | "sound" | "behavior" | "item";

interface CatalogEntryBase {
  id: string;
  /** Human-readable name for level authors. */
  label: string;
}

/**
 * What a terrain shape is made of: how it behaves and sounds, and the surface pattern that shows
 * the behaviour. Colour is a separate axis (`color` kind); any colour goes on any material.
 */
export interface MaterialEntry extends CatalogEntryBase {
  /**
   * How hard it is to blast away (blast-power D1, D2): a blast clears a cell when distance ×
   * toughness ≤ its crater reach, so 0.5 opens twice the crater of 1. `null` = unbreakable.
   */
  toughness: number | null;
  /** 0 = ice … 1 = grippy. Scales the blob's grounded acceleration and braking. */
  friction: number;
  /** 0 = dead stop … 1 = full bounce. */
  bounce: number;
  /** Surface pattern drawn over the colour (the non-colour cue for the behaviour). */
  surface: MaterialSurface;
  /** Colour ID used when a shape names none. */
  defaultColor: string;
  /**
   * Its row of the material × element table (mover-materials D1; rules from blast-power D5):
   * what it does when fire and when cold meet it. Blasts read `toughness` above.
   */
  reactions: MaterialReactions;
  /** Default effect ID when cells are destroyed (a shape's data-effect overrides it). */
  effect: string;
  /** Default sound ID when cells are hit or destroyed (a shape's data-sound overrides it). */
  sound: string;
}

/** A named terrain colour; its RGB lives in the game palette (`terrainSwatches`). */
export type ColorEntry = CatalogEntryBase;
export type EffectEntry = CatalogEntryBase;
export type SoundEntry = CatalogEntryBase;
export type BehaviorEntry = CatalogEntryBase;

/** The point role an item belongs to: dropped from drop points, or placed as a collectible. */
export type ItemUse = "drop" | "collectible";

export interface ItemEntry extends CatalogEntryBase {
  /** Where the item appears: from drop points, or as a collectible. */
  use: ItemUse;
}

export interface CatalogEntryByKind {
  material: MaterialEntry;
  color: ColorEntry;
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
  /** Material of a terrain shape without `data-material`. */
  material: string;
  items: { collectible: string };
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
