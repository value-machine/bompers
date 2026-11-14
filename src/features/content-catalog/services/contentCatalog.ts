import type {
  CatalogEntryByKind,
  ContentCatalog,
  ContentKind,
  ExportedCatalog,
  ResolvedEntry,
} from "@/features/content-catalog/types/contentCatalog.types";

/**
 * The content catalog: the single source of which material, effect, sound, behavior and item
 * IDs exist. Levels reference these IDs only; the engine resolves them here. New content =
 * a new entry here (and its look / sound wherever that kind is rendered or played).
 */
export const CATALOG_VERSION = 1;

export const CONTENT_CATALOG: ContentCatalog = {
  material: {
    stone: {
      id: "stone",
      name: "Stone",
      description: "Indestructible base terrain. Keeps the map playable.",
      destructible: false,
      durability: 0,
      friction: 1,
      bounce: 0,
      lookToken: "stone",
      impactSoundId: "thud",
      destroySoundId: "none",
      destroyEffectId: "none",
    },
    dirt: {
      id: "dirt",
      name: "Dirt",
      description: "Destructible terrain. One rocket blast clears it.",
      destructible: true,
      durability: 1,
      friction: 1,
      bounce: 0,
      lookToken: "dirt",
      impactSoundId: "thud",
      destroySoundId: "crumble",
      destroyEffectId: "dust-burst",
    },
  },
  effect: {
    none: { id: "none", name: "None", description: "No effect." },
    "dust-burst": {
      id: "dust-burst",
      name: "Dust burst",
      description: "Cell-coloured debris and dust where terrain is cleared.",
    },
  },
  sound: {
    none: { id: "none", name: "None", description: "Silent." },
    thud: { id: "thud", name: "Thud", description: "Something lands on or hits terrain." },
    crumble: { id: "crumble", name: "Crumble", description: "Terrain breaks apart." },
  },
  behavior: {},
  item: {
    "rocket-launcher": {
      id: "rocket-launcher",
      name: "Rocket launcher",
      description: "The MVP weapon: fires rockets from the helmet.",
      category: "pickup",
    },
    "point-orb": {
      id: "point-orb",
      name: "Point orb",
      description: "Falls from the roof; picking it up scores points.",
      category: "collectible",
    },
  },
};

/** What an unknown ID resolves to, per kind (null = drop the reference). */
export const FALLBACK_IDS: Readonly<Record<ContentKind, string | null>> = {
  material: "stone",
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

/** Looks up an ID; unknown IDs give the kind's fallback entry with `fallback: true`. */
export function resolveCatalogEntry<K extends ContentKind>(kind: K, id: string): ResolvedEntry<K> {
  const entries = CONTENT_CATALOG[kind] as Readonly<Record<string, CatalogEntryByKind[K]>>;
  if (ownKey(entries, id)) return { entry: entries[id] ?? null, fallback: false };
  const fallbackId = FALLBACK_IDS[kind];
  return { entry: fallbackId === null ? null : (entries[fallbackId] ?? null), fallback: true };
}

/** Plain JSON copy of the catalog for the level kit (no functions, no shared references). */
export function exportCatalog(): ExportedCatalog {
  const values = <K extends ContentKind>(kind: K): CatalogEntryByKind[K][] =>
    structuredClone(Object.values(CONTENT_CATALOG[kind])) as CatalogEntryByKind[K][];
  return {
    catalogVersion: CATALOG_VERSION,
    fallbackIds: { ...FALLBACK_IDS },
    entries: {
      material: values("material"),
      effect: values("effect"),
      sound: values("sound"),
      behavior: values("behavior"),
      item: values("item"),
    },
  };
}
