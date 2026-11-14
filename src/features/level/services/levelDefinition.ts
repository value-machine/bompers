import {
  resolveCatalogEntry,
  type ContentKind,
} from "@/features/content-catalog/api/contentCatalogApi";
import type {
  LevelDefinition,
  LevelSettings,
  NormalizedLevel,
  TerrainPiece,
  TerrainRole,
} from "@/features/level/types/levelDefinition.types";

/**
 * Level defaults and normalisation. The engine runs only on a normalised level: every ID it
 * holds exists in the content catalog. Unknown IDs never crash; they are replaced (or dropped)
 * and reported as warnings for the author.
 */
export const LEVEL_FORMAT_VERSION = 1;

export const DEFAULT_LEVEL_SETTINGS: LevelSettings = { cellSize: 8, gravity: 1 };

export const DEFAULT_MATERIAL_BY_ROLE: Readonly<Record<TerrainRole, string>> = {
  platform: "stone",
  destructible: "dirt",
};

/** Items a drop point / collectible spawn produces when the file names none (or none known). */
export const DEFAULT_POINT_ITEMS: Readonly<{ drop: readonly string[]; collectible: string }> = {
  drop: ["rocket-launcher"],
  collectible: "point-orb",
};

const MIN_SPAWNS = 2;

const knownOrWarn = (
  ref: { kind: ContentKind; id: string | undefined; where: string },
  warnings: string[]
): string | undefined => {
  if (ref.id === undefined) return undefined;
  const { entry, fallback } = resolveCatalogEntry(ref.kind, ref.id);
  if (!fallback) return ref.id;
  warnings.push(
    `${ref.where}: unknown ${ref.kind} "${ref.id}", using ${entry ? `"${entry.id}"` : "none"}`
  );
  return entry?.id;
};

function normalizePiece(piece: TerrainPiece, index: number, warnings: string[]): TerrainPiece {
  const where = `terrain[${index}]`;
  let materialId = piece.materialId;
  if (resolveCatalogEntry("material", materialId).fallback) {
    materialId = DEFAULT_MATERIAL_BY_ROLE[piece.role];
    warnings.push(`${where}: unknown material "${piece.materialId}", using "${materialId}"`);
  }
  const material = resolveCatalogEntry("material", materialId).entry;
  if (piece.role === "destructible" && material && !material.destructible) {
    warnings.push(
      `${where}: role "destructible" with indestructible material "${materialId}" stays solid`
    );
  }
  const effectId = knownOrWarn({ kind: "effect", id: piece.effectId, where }, warnings);
  const soundId = knownOrWarn({ kind: "sound", id: piece.soundId, where }, warnings);
  const behaviorId = knownOrWarn({ kind: "behavior", id: piece.behaviorId, where }, warnings);
  return {
    shape: piece.shape,
    role: piece.role,
    materialId,
    ...(effectId !== undefined && { effectId }),
    ...(soundId !== undefined && { soundId }),
    ...(behaviorId !== undefined && { behaviorId }),
  };
}

const knownItems = (itemIds: readonly string[], where: string, warnings: string[]): string[] =>
  itemIds.filter((id) => knownOrWarn({ kind: "item", id, where }, warnings) !== undefined);

/** Returns a copy whose IDs all exist in the catalog, plus warnings for each correction. */
export function normalizeLevelDefinition(level: LevelDefinition): NormalizedLevel {
  const warnings: string[] = [];
  if (level.spawns.length < MIN_SPAWNS) {
    warnings.push(`spawns: ${level.spawns.length} given, at least ${MIN_SPAWNS} expected`);
  }
  const normalized: LevelDefinition = {
    ...level,
    settings: { ...DEFAULT_LEVEL_SETTINGS, ...level.settings },
    terrain: level.terrain.map((piece, i) => normalizePiece(piece, i, warnings)),
    drops: level.drops
      .map((drop, i) => ({
        at: drop.at,
        itemIds: knownItems(drop.itemIds, `drops[${i}]`, warnings),
      }))
      .filter((drop) => drop.itemIds.length > 0),
    collectibles: level.collectibles.filter(
      (c, i) => knownItems([c.itemId], `collectibles[${i}]`, warnings).length > 0
    ),
  };
  return { level: normalized, warnings };
}
