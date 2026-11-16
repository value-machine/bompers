import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type {
  CatalogDefaults,
  CatalogEntryByKind,
  ContentCatalog,
  ContentKind,
  ExportedCatalog,
  ResolvedEntry,
} from "@/features/content-catalog/types/contentCatalog.types";

/**
 * The content catalog: the single source of which material, effect, sound, behavior and item
 * IDs exist, and of the level defaults. Levels reference these IDs only; the engine resolves
 * them here. New content = a new entry here (plus its look / sound where that kind is drawn or
 * played). IDs are never renamed or reused once shipped (LEVEL_FORMAT.md § 6).
 */
export const LEVEL_FORMAT_VERSION = 1;

export const CONTENT_CATALOG: ContentCatalog = {
  material: {
    stone: {
      id: "stone",
      label: "Stone",
      destructible: false,
      durability: 0,
      friction: 1,
      bounce: 0,
      lookToken: "stone",
      effect: "none",
      sound: "thud",
    },
    dirt: {
      id: "dirt",
      label: "Dirt",
      destructible: true,
      durability: 1,
      friction: 1,
      bounce: 0,
      lookToken: "dirt",
      effect: "dust-burst",
      sound: "crumble",
    },
  },
  effect: {
    none: { id: "none", label: "No effect" },
    "dust-burst": { id: "dust-burst", label: "Dust burst" },
  },
  sound: {
    none: { id: "none", label: "Silent" },
    thud: { id: "thud", label: "Thud" },
    crumble: { id: "crumble", label: "Crumble" },
    // Game SFX (DESIGN_LANGUAGE § 8); files and takes live in the sound feature's bank.
    jump: { id: "jump", label: "Jump" },
    land: { id: "land", label: "Land" },
    "tumble-bounce": { id: "tumble-bounce", label: "Tumble bounce" },
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
  },
  behavior: {},
  item: {
    "rocket-launcher": { id: "rocket-launcher", label: "Rocket launcher", use: "drop" },
    "homing-launcher": { id: "homing-launcher", label: "Homing launcher", use: "drop" },
    "point-orb": { id: "point-orb", label: "Point orb", use: "collectible" },
  },
};

export const CATALOG_DEFAULTS: CatalogDefaults = {
  cellSize: 8,
  gravity: 1,
  matchDuration: DEFAULT_GAME_TUNABLES.match.durationSeconds,
  material: { platform: "stone", destructible: "dirt" },
  items: { drop: ["rocket-launcher"], collectible: "point-orb" },
};

/** What an unknown ID resolves to per kind, when no role default applies (null = none). */
export const FALLBACK_IDS: Readonly<Record<ContentKind, string | null>> = {
  material: CATALOG_DEFAULTS.material.platform,
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
    effect: values("effect"),
    sound: values("sound"),
    behavior: values("behavior"),
    item: values("item"),
  };
}
