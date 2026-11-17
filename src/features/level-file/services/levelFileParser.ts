import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { shapeContains } from "@/shared/utils/shapeGeometry";
import {
  LEVEL_FORMAT_VERSION,
  normalizeLevelDefinition,
  type LevelCollectible,
  type LevelDefinition,
  type LevelDrop,
  type LevelMover,
  type TerrainPiece,
} from "@/features/level/api/levelApi";
import { checkMoverSweeps, collectMovers } from "@/features/level-file/services/levelFileMotion";
import {
  checkPointBehavior,
  collectRoleElements,
  readCollectibleItem,
  readDropItems,
  readTerrainRefs,
} from "@/features/level-file/services/levelFileElements";
import {
  readPoint,
  readRect,
  readShape,
  rectContainsPoint,
  rectContainsRect,
} from "@/features/level-file/services/levelFileGeometry";
import {
  addError,
  addWarning,
  createIssueLog,
  type LevelIssueLog,
} from "@/features/level-file/services/levelFileIssues";
import type { MigrationOptions } from "@/features/level-file/services/levelFileMigrations";
import {
  findLevelRoot,
  readLevelMeta,
  readLevelSettings,
  readWorldSize,
  upgradeFormatVersion,
} from "@/features/level-file/services/levelFileRoot";
import type { LevelIssue, RoleElement } from "@/features/level-file/types/levelFile.types";

/**
 * Level file importer: HTML (or bare SVG) text → normalised `LevelDefinition` plus the spec's
 * errors and warnings (documentation/game/LEVEL_FORMAT.md § 7). Only the root
 * `<svg data-level-format>` is read; presentation (fills, text, comments) is ignored.
 */
/** Declared here, not in types/: it names `LevelDefinition` from another feature. */
export type LevelImportResult =
  | { ok: true; level: LevelDefinition; warnings: LevelIssue[] }
  | { ok: false; errors: LevelIssue[]; warnings: LevelIssue[] };

/** Fewer valid spawns than this rejects the file (E5). */
export const MIN_SPAWNS = 2;
/** Fewer than this warns (W6): 4-player rounds would share spawns. */
export const RECOMMENDED_SPAWNS = 4;

const ofRole = <R extends RoleElement["role"]>(items: readonly RoleElement[], ...roles: R[]) =>
  items.filter((item): item is RoleElement & { role: R } => roles.includes(item.role as R));

/** Terrain pieces in document order (the raster resolves overlaps, LEVEL_FORMAT § 4), with the element of each. */
function readTerrain(
  items: readonly RoleElement[],
  log: LevelIssueLog
): { pieces: TerrainPiece[]; els: Element[] } {
  const pieces: TerrainPiece[] = [];
  const els: Element[] = [];
  for (const item of ofRole(items, "terrain")) {
    const shape = readShape(item, log);
    if (!shape) continue;
    pieces.push({ shape, ...readTerrainRefs(item, log) });
    els.push(item.el);
  }
  return { pieces, els };
}

/** E4: exactly one bounds rect, inside the world. */
function readBounds(
  items: readonly RoleElement[],
  world: { w: number; h: number },
  log: LevelIssueLog
): Rect | null {
  const candidates = ofRole(items, "bounds");
  const rects = candidates.map((item) => readRect(item, log));
  if (candidates.length !== 1) {
    addError(
      log,
      "E4",
      candidates.length === 0
        ? 'No bounds: add exactly one <rect data-role="bounds">.'
        : `Found ${candidates.length} bounds rects; exactly one is allowed.`
    );
    return null;
  }
  const rect = rects[0];
  if (!rect) return null;
  if (!rectContainsRect({ x: 0, y: 0, ...world }, rect)) {
    addError(
      log,
      "E4",
      `${candidates[0]!.name} lies outside the viewBox (0 0 ${world.w} ${world.h}).`
    );
    return null;
  }
  return rect;
}

interface PointContext {
  bounds: Rect | null;
  terrain: readonly TerrainPiece[];
  log: LevelIssueLog;
}

/** W5: points outside bounds (and spawns inside terrain) are skipped. */
function placedPoint(item: RoleElement, ctx: PointContext): Vec2 | null {
  const at = readPoint(item, ctx.log);
  if (!at) return null;
  checkPointBehavior(item, ctx.log);
  if (!ctx.bounds) return at;
  if (!rectContainsPoint(ctx.bounds, at)) {
    addWarning(ctx.log, "W5", `${item.name} lies outside bounds; ignored.`);
    return null;
  }
  if (item.role === "spawn" && ctx.terrain.some((piece) => shapeContains(piece.shape, at))) {
    addWarning(ctx.log, "W5", `${item.name} is inside solid terrain; ignored.`);
    return null;
  }
  return at;
}

function readSpawns(items: readonly RoleElement[], ctx: PointContext): Vec2[] {
  const spawns = ofRole(items, "spawn").flatMap((item) => placedPoint(item, ctx) ?? []);
  if (spawns.length < MIN_SPAWNS) {
    addError(
      ctx.log,
      "E5",
      `Only ${spawns.length} valid spawn point(s); at least ${MIN_SPAWNS} are needed.`
    );
  } else if (spawns.length < RECOMMENDED_SPAWNS) {
    addWarning(
      ctx.log,
      "W6",
      `Only ${spawns.length} spawn points; 4-player rounds will share spawns.`
    );
  }
  return spawns;
}

function readDrops(items: readonly RoleElement[], ctx: PointContext): LevelDrop[] {
  const drops = ofRole(items, "drop").flatMap((item) => {
    const at = placedPoint(item, ctx);
    return at ? [{ at, itemIds: readDropItems(item, ctx.log) }] : [];
  });
  if (drops.length === 0) {
    addError(ctx.log, "E7", 'No valid drop point: add at least one <circle data-role="drop">.');
  }
  return drops;
}

const readCollectibles = (items: readonly RoleElement[], ctx: PointContext): LevelCollectible[] =>
  ofRole(items, "collectible").flatMap((item) => {
    const at = placedPoint(item, ctx);
    return at ? [{ at, itemId: readCollectibleItem(item, ctx.log) }] : [];
  });

type LevelContent = Pick<
  LevelDefinition,
  "terrain" | "spawns" | "drops" | "collectibles" | "bounds" | "movers"
>;

/** Engine note while moving parts are import-only (moving-parts lap A). */
export const MOVERS_STATIC_NOTE =
  "Moving parts stand still at their drawn place in this version of the game.";

interface ContentArgs {
  root: Element;
  world: { w: number; h: number };
  cellSize: number;
  log: LevelIssueLog;
}

/** Moving parts (W12–W14) once terrain, spawns and bounds are known. */
function readMovers(
  args: ContentArgs,
  content: {
    items: readonly RoleElement[];
    terrain: ReturnType<typeof readTerrain>;
    spawns: Vec2[];
    bounds: Rect;
  }
): LevelMover[] {
  const { root, cellSize, log } = args;
  const { items, terrain, spawns, bounds } = content;
  const movers = collectMovers({
    root,
    items,
    terrain: terrain.pieces,
    terrainEls: terrain.els,
    cellSize,
    log,
  });
  checkMoverSweeps({ movers, terrain: terrain.pieces, spawns, bounds, log });
  if (movers.length > 0) log.warnings.push({ message: MOVERS_STATIC_NOTE });
  return movers.map(({ mover }) => mover);
}

function readContent(args: ContentArgs): LevelContent | null {
  const { root, world, log } = args;
  const items = collectRoleElements(root, log);
  const terrainRead = readTerrain(items, log);
  const terrain = terrainRead.pieces;
  if (terrain.length === 0) {
    addError(log, "E6", "No valid terrain: add at least one platform or destructible shape.");
  }
  const bounds = readBounds(items, world, log);
  const ctx: PointContext = { bounds, terrain, log };
  const spawns = readSpawns(items, ctx);
  const drops = readDrops(items, ctx);
  const collectibles = readCollectibles(items, ctx);
  if (!bounds) return null;
  const movers = readMovers(args, { items, terrain: terrainRead, spawns, bounds });
  return { terrain, spawns, drops, collectibles, bounds, ...(movers.length > 0 && { movers }) };
}

const rejected = (log: LevelIssueLog): LevelImportResult => ({
  ok: false,
  errors: log.errors,
  warnings: log.warnings,
});

export type ParseLevelFileOptions = MigrationOptions;

/** Parses a level file. Never throws: a broken file comes back as `ok: false` with errors. */
export function parseLevelFile(
  text: string,
  options: ParseLevelFileOptions = {}
): LevelImportResult {
  const log = createIssueLog();
  const doc = new DOMParser().parseFromString(text, "text/html");
  const root = findLevelRoot(doc, log);
  if (!root || !upgradeFormatVersion(root, log, options)) return rejected(log);
  const worldSize = readWorldSize(root, log);
  if (!worldSize) return rejected(log);
  const meta = readLevelMeta(root, log);
  const settings = readLevelSettings(root, log);
  const content = readContent({ root, world: worldSize, cellSize: settings.cellSize, log });
  if (!content || log.errors.length > 0) return rejected(log);
  const formatVersion = options.toVersion ?? LEVEL_FORMAT_VERSION;
  const normalized = normalizeLevelDefinition({
    formatVersion,
    meta,
    settings,
    worldSize,
    ...content,
  });
  return {
    ok: true,
    level: normalized.level,
    warnings: [...log.warnings, ...normalized.warnings.map((message) => ({ message }))],
  };
}
