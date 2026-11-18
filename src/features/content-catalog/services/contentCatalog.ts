import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type {
  CatalogDefaults,
  CatalogEntryByKind,
  ContentCatalog,
  ContentKind,
  ExportedCatalog,
  ItemUse,
  ResolvedEntry,
} from "@/features/content-catalog/types/contentCatalog.types";

/**
 * The content catalog: the single source of which material, effect, sound, behavior and item
 * IDs exist, and of the level defaults. Levels reference these IDs only; the engine resolves
 * them here. New content = a new entry here (plus its look / sound where that kind is drawn or
 * played). IDs are never renamed or reused once shipped (LEVEL_FORMAT.md § 6).
 */
export const LEVEL_FORMAT_VERSION = 2;

export const CONTENT_CATALOG: ContentCatalog = {
  material: {
    stone: {
      id: "stone",
      label: "Stone",
      toughness: null,
      friction: 1,
      bounce: 0,
      surface: "plain",
      burns: false,
      douses: false,
      defaultColor: "plum",
      effect: "none",
      sound: "thud",
    },
    earth: {
      id: "earth",
      label: "Earth",
      toughness: 1,
      friction: 1,
      bounce: 0,
      // Looks like any slab; only colour and how it reacts tell it apart (terrain-curves D5).
      surface: "plain",
      // Not fuel: fire scorches it and stops (blast-power D5).
      burns: false,
      douses: false,
      defaultColor: "clay",
      effect: "dust-burst",
      sound: "crumble",
    },
    cardboard: {
      id: "cardboard",
      label: "Cardboard",
      // Softer than earth: the same blast opens a crater 1 / 0.7 ≈ 1.4× as wide (blast-power D2).
      toughness: 0.7,
      friction: 1,
      bounce: 0,
      // Looks like any slab; only colour and how it reacts tell it apart (terrain-curves D5).
      surface: "plain",
      // The fuel: fire spreads through it and burns it away (blast-power D5, D6).
      burns: true,
      douses: false,
      defaultColor: "cardboard",
      effect: "dust-burst",
      sound: "thwap",
    },
    ice: {
      id: "ice",
      label: "Ice",
      toughness: null,
      friction: 0.12,
      bounce: 0,
      surface: "ice",
      burns: false,
      // Fuel touching ice never catches (blast-power D5).
      douses: true,
      defaultColor: "frost",
      effect: "none",
      sound: "clink",
    },
  },
  // Any colour goes on any material; RGB per ID in gamePalette.terrainSwatches.
  color: {
    plum: { id: "plum", label: "Plum" },
    slate: { id: "slate", label: "Slate" },
    cardboard: { id: "cardboard", label: "Cardboard" },
    clay: { id: "clay", label: "Clay" },
    moss: { id: "moss", label: "Moss" },
    mint: { id: "mint", label: "Mint" },
    frost: { id: "frost", label: "Frost" },
    rose: { id: "rose", label: "Rose" },
  },
  effect: {
    none: { id: "none", label: "No effect" },
    "dust-burst": { id: "dust-burst", label: "Dust burst" },
  },
  sound: {
    none: { id: "none", label: "Silent" },
    thud: { id: "thud", label: "Thud" },
    crumble: { id: "crumble", label: "Crumble" },
    thwap: { id: "thwap", label: "Thwap" },
    clink: { id: "clink", label: "Clink" },
    // Game SFX (DESIGN_LANGUAGE § 8); files and takes live in the sound feature's bank.
    jump: { id: "jump", label: "Jump" },
    land: { id: "land", label: "Land" },
    "tumble-bounce": { id: "tumble-bounce", label: "Roll bounce" },
    "dive-launch": { id: "dive-launch", label: "Dive launch" },
    "dive-impact": { id: "dive-impact", label: "Dive impact" },
    hit: { id: "hit", label: "Hit" },
    elimination: { id: "elimination", label: "Elimination" },
    "rocket-fire": { id: "rocket-fire", label: "Rocket fire" },
    explosion: { id: "explosion", label: "Explosion" },
    pickup: { id: "pickup", label: "Pickup" },
    respawn: { id: "respawn", label: "Respawn" },
    "round-start": { id: "round-start", label: "Round start" },
    "round-end": { id: "round-end", label: "Round end" },
    // Fire and ice sounds (owner picks, element-sounds lap); loops are held while their source lasts.
    "torch-start": { id: "torch-start", label: "Torch start" },
    "torch-loop": { id: "torch-loop", label: "Torch spraying (loop)" },
    "fire-crackle": { id: "fire-crackle", label: "Fire crackle (loop)" },
    "burn-out": { id: "burn-out", label: "Burn-out" },
    "catch-fire": { id: "catch-fire", label: "Catch fire" },
    "steam-hiss": { id: "steam-hiss", label: "Steam hiss" },
    "freeze-start": { id: "freeze-start", label: "Freeze start" },
    "freeze-loop": { id: "freeze-loop", label: "Freeze ray (loop)" },
    thaw: { id: "thaw", label: "Thaw" },
  },
  behavior: {},
  item: {
    "rocket-launcher": { id: "rocket-launcher", label: "Rocket launcher", use: "drop" },
    "homing-launcher": { id: "homing-launcher", label: "Homing launcher", use: "drop" },
    // A short flame cone that lights cardboard (blast-power D8, fire-spread b1).
    torch: { id: "torch", label: "Torch", use: "drop" },
    // A held beam that freezes the ground it touches (owner, ice-element D1).
    "freeze-ray": { id: "freeze-ray", label: "Freeze ray", use: "drop" },
    "point-orb": { id: "point-orb", label: "Point orb", use: "collectible" },
    // Placed, not dropped: gives a spent dive its charge back mid-flight (headbutt-reset D1).
    "dive-reset": { id: "dive-reset", label: "Headbutt reset", use: "collectible" },
  },
};

export const CATALOG_DEFAULTS: CatalogDefaults = {
  // Terrain sample spacing (terrain-field D1): fine enough for curved craters and slopes.
  cellSize: 4,
  gravity: 1,
  matchDuration: DEFAULT_GAME_TUNABLES.match.durationSeconds,
  material: "stone",
  items: { drop: ["rocket-launcher"], collectible: "point-orb" },
};

/** What an unknown ID resolves to per kind, when no role default applies (null = none). */
export const FALLBACK_IDS: Readonly<Record<ContentKind, string | null>> = {
  material: CATALOG_DEFAULTS.material,
  color: null,
  effect: "none",
  sound: "none",
  behavior: null,
  item: null,
};

const ownKey = (record: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(record, key);

export function hasCatalogEntry(kind: ContentKind, id: string): boolean {
  return ownKey(CONTENT_CATALOG[kind], id);
}

/** The role a known item belongs to (its `use`), or null when the ID is not an item. */
export function itemUseOf(id: string): ItemUse | null {
  return ownKey(CONTENT_CATALOG.item, id) ? (CONTENT_CATALOG.item[id]?.use ?? null) : null;
}

/** Looks up an ID; unknown IDs give the kind's fallback entry with `isFallback: true`. */
export function resolveCatalogEntry<K extends ContentKind>(kind: K, id: string): ResolvedEntry<K> {
  const entries = CONTENT_CATALOG[kind] as Readonly<Record<string, CatalogEntryByKind[K]>>;
  if (ownKey(entries, id)) return { entry: entries[id] ?? null, isFallback: false };
  const fallbackId = FALLBACK_IDS[kind];
  return { entry: fallbackId === null ? null : (entries[fallbackId] ?? null), isFallback: true };
}

/** Plain JSON copy of the catalog in the kit's catalog.json shape. */
export function exportCatalog(): ExportedCatalog {
  const values = <K extends ContentKind>(kind: K): CatalogEntryByKind[K][] =>
    structuredClone(Object.values(CONTENT_CATALOG[kind])) as CatalogEntryByKind[K][];
  return {
    formatVersion: LEVEL_FORMAT_VERSION,
    defaults: structuredClone(CATALOG_DEFAULTS),
    material: values("material"),
    color: values("color"),
    effect: values("effect"),
    sound: values("sound"),
    behavior: values("behavior"),
    item: values("item"),
  };
}
