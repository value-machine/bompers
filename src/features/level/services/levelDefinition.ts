import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { isWeaponItemId } from "@/shared/config/weaponItems";
import { isBackdropThemeId } from "@/features/backdrop/api/backdropThemesApi";
import {
  CATALOG_DEFAULTS,
  LEVEL_FORMAT_VERSION,
  hasCatalogEntry,
  resolveCatalogEntry,
  type ContentKind,
} from "@/features/content-catalog/api/contentCatalogApi";
import type {
  LevelDefinition,
  LevelSettings,
  NormalizedLevel,
  TerrainPiece,
} from "@/features/level/types/levelDefinition.types";

/**
 * Level defaults and normalisation (documentation/game/LEVEL_FORMAT.md § 7 warnings that apply to
 * a parsed level). The engine runs only on a normalised level: every ID it holds exists in the
 * content catalog. Nothing throws; each correction adds a warning naming its path.
 */
export { LEVEL_FORMAT_VERSION };

export const DEFAULT_LEVEL_SETTINGS: LevelSettings = {
  cellSize: CATALOG_DEFAULTS.cellSize,
  gravity: CATALOG_DEFAULTS.gravity,
};

/** Players share spawns, so one runs a round (forgiving-import: the file warns W6 below 4). */
const MIN_SPAWNS = 1;

type Warnings = string[];

/** Keeps a known optional reference; drops an unknown one (the material's default applies). */
function knownRef(
  ref: { kind: ContentKind; id: string | undefined; where: string },
  warnings: Warnings
): string | undefined {
  if (ref.id === undefined || hasCatalogEntry(ref.kind, ref.id)) return ref.id;
  warnings.push(`${ref.where}: unknown ${ref.kind} "${ref.id}", using the default`);
  return undefined;
}

/** A setting value if it passes `valid`, else the default plus a warning (W8). */
function checkedSetting<T>(
  value: T | undefined,
  rule: { valid: (v: T) => boolean; fallback: T; where: string },
  warnings: Warnings
): T {
  if (value === undefined) return rule.fallback;
  if (rule.valid(value)) return value;
  warnings.push(`${rule.where}: out of range, using the default`);
  return rule.fallback;
}

const isPositiveInteger = (v: number): boolean => Number.isInteger(v) && v >= 1;

function normalizeSettings(settings: Partial<LevelSettings>, warnings: Warnings): LevelSettings {
  const cellSize = checkedSetting(
    settings.cellSize,
    {
      valid: isPositiveInteger,
      fallback: DEFAULT_LEVEL_SETTINGS.cellSize,
      where: "settings.cellSize",
    },
    warnings
  );
  const gravity = checkedSetting(
    settings.gravity,
    { valid: (v) => v > 0, fallback: DEFAULT_LEVEL_SETTINGS.gravity, where: "settings.gravity" },
    warnings
  );
  const matchDurationS = checkedSetting<number | undefined>(
    settings.matchDurationS,
    {
      valid: (v) => v !== undefined && isPositiveInteger(v),
      fallback: undefined,
      where: "settings.matchDurationS",
    },
    warnings
  );
  const weaponIds = normalizeWeaponIds(settings.weaponIds, warnings);
  const themeId = normalizeThemeId(settings.themeId, warnings);
  return {
    cellSize,
    gravity,
    ...(matchDurationS !== undefined && { matchDurationS }),
    ...(weaponIds !== undefined && { weaponIds }),
    ...(themeId !== undefined && { themeId }),
  };
}

/** An unknown theme is dropped, so the default theme applies. */
function normalizeThemeId(themeId: string | undefined, warnings: Warnings): string | undefined {
  if (themeId === undefined || isBackdropThemeId(themeId)) return themeId;
  warnings.push(`settings.themeId: "${themeId}" is not a theme, using the default`);
  return undefined;
}

/**
 * W4: non-weapon IDs are removed. An empty list stays (no weapons); a list left empty only by
 * removals is dropped, so the lobby's choice applies.
 */
function normalizeWeaponIds(
  weaponIds: readonly string[] | undefined,
  warnings: Warnings
): readonly string[] | undefined {
  if (weaponIds === undefined) return undefined;
  const known = weaponIds.filter((id) => isWeaponItemId(id));
  for (const id of weaponIds) {
    if (!isWeaponItemId(id)) warnings.push(`settings.weaponIds: "${id}" is not a weapon, left out`);
  }
  return known.length > 0 || weaponIds.length === 0 ? known : undefined;
}

/** The material's default colour (stone's when the material has no entry). */
const defaultColorOf = (materialId: string): string =>
  resolveCatalogEntry("material", materialId).entry?.defaultColor ?? "plum";

/**
 * W4: unknown material → the default material; unknown or missing colour → the material's
 * default colour; unknown effect / sound / behavior → dropped.
 */
function normalizePiece(piece: TerrainPiece, where: string, warnings: Warnings): TerrainPiece {
  let { materialId } = piece;
  if (!hasCatalogEntry("material", materialId)) {
    materialId = CATALOG_DEFAULTS.material;
    warnings.push(`${where}: unknown material "${piece.materialId}", using "${materialId}"`);
  }
  let colorId = piece.colorId ?? defaultColorOf(materialId);
  if (!hasCatalogEntry("color", colorId)) {
    colorId = defaultColorOf(materialId);
    warnings.push(`${where}: unknown color "${piece.colorId}", using "${colorId}"`);
  }
  const effectId = knownRef({ kind: "effect", id: piece.effectId, where }, warnings);
  const soundId = knownRef({ kind: "sound", id: piece.soundId, where }, warnings);
  const behaviorId = knownRef({ kind: "behavior", id: piece.behaviorId, where }, warnings);
  return {
    shape: piece.shape,
    materialId,
    colorId,
    ...(effectId !== undefined && { effectId }),
    ...(soundId !== undefined && { soundId }),
    ...(behaviorId !== undefined && { behaviorId }),
  };
}

const knownItemOrDefault = (itemId: string, where: string, warnings: Warnings): string =>
  knownRef({ kind: "item", id: itemId, where }, warnings) ?? CATALOG_DEFAULTS.items.collectible;

/** W5: points outside the bounds are ignored. */
function insideBounds<T>(
  list: readonly T[],
  args: { pointOf: (item: T) => Vec2; level: LevelDefinition; name: string },
  warnings: Warnings
): T[] {
  const { x, y, w, h } = args.level.bounds;
  return list.filter((item, i) => {
    const p = args.pointOf(item);
    const inside = p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
    if (!inside) warnings.push(`${args.name}[${i}]: outside bounds, ignored`);
    return inside;
  });
}

/** Returns a copy the engine can run on, plus a warning for each correction. */
export function normalizeLevelDefinition(level: LevelDefinition): NormalizedLevel {
  const warnings: Warnings = [];
  const spawns = insideBounds(level.spawns, { pointOf: (p) => p, level, name: "spawns" }, warnings);
  if (spawns.length < MIN_SPAWNS) {
    warnings.push(`spawns: ${spawns.length} valid, at least ${MIN_SPAWNS} expected`);
  }
  const drops = insideBounds(level.drops, { pointOf: (d) => d.at, level, name: "drops" }, warnings);
  const collectibles = insideBounds(
    level.collectibles,
    { pointOf: (c) => c.at, level, name: "collectibles" },
    warnings
  );
  const normalized: LevelDefinition = {
    ...level,
    settings: normalizeSettings(level.settings, warnings),
    terrain: level.terrain.map((piece, i) => normalizePiece(piece, `terrain[${i}]`, warnings)),
    spawns,
    drops: drops.map((drop) => ({ at: drop.at })),
    collectibles: collectibles.map((c, i) => ({
      at: c.at,
      itemId: knownItemOrDefault(c.itemId, `collectibles[${i}]`, warnings),
    })),
  };
  return { level: normalized, warnings };
}
