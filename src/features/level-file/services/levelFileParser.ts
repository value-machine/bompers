import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { shapeContains } from "@/shared/utils/shapeGeometry";
import {
  LEVEL_FORMAT_VERSION,
  normalizeLevelDefinition,
  type LevelCollectible,
  type LevelDefinition,
  type LevelDrop,
  type LevelMover,
  type LevelObject,
  type TerrainPiece,
} from "@/features/level/api/levelApi";
import { placeObject } from "@/features/level-objects/api/levelObjectsApi";
import { checkMoverSweeps, collectMovers } from "@/features/level-file/services/levelFileMotion";
import {
  checkPointBehavior,
  collectRoleElements,
  readCollectibleItem,
  readObjectRequest,
  readTerrainRefs,
} from "@/features/level-file/services/levelFileElements";
import {
  readPoint,
  readRect,
  fallbackSpawns,
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

/** Fewer than this warns (W6): 4-player rounds would share spawns. None at all: W19 / E5. */
export const RECOMMENDED_SPAWNS = 4;

const ofRole = <R extends RoleElement["role"]>(items: readonly RoleElement[], ...roles: R[]) =>
  items.filter((item): item is RoleElement & { role: R } => roles.includes(item.role as R));

interface TerrainRead {
  pieces: TerrainPiece[];
  /** The element of each piece (an object's element once per piece, so movers find them). */
  els: Element[];
  objects: LevelObject[];
}

/**
 * An object element built into terrain pieces (level-objects D6): W22 unknown kind (skipped),
 * W23 each correction the registry made (unknown variant, clamped size).
 */
function addObject(
  item: RoleElement,
  ctx: { levelId: string; ordinal: number; log: LevelIssueLog },
  read: TerrainRead
): void {
  const box = readRect(item, ctx.log);
  const request = box && readObjectRequest(item, ctx, ctx.log);
  if (!box || !request) return;
  const placed = placeObject({ ...request, box });
  if (!placed.ok) {
    addWarning(ctx.log, "W22", `${item.name}: unknown object kind "${request.kind}"; ignored.`);
    return;
  }
  for (const note of placed.notes) addWarning(ctx.log, "W23", `${item.name}: ${note}.`);
  const first = read.pieces.length;
  for (const { shape, materialId, colorId } of placed.parts) {
    read.pieces.push({ shape, materialId, colorId });
    read.els.push(item.el);
  }
  const terrainIndices = placed.parts.map((_, i) => first + i);
  const { kind, variant, seed } = placed;
  read.objects.push({ kind, variant, box: placed.box, seed, terrainIndices });
}

/**
 * Terrain pieces in document order (the raster resolves overlaps, LEVEL_FORMAT § 4), with the
 * element of each; placed objects add their parts where they stand in the document.
 */
function readTerrain(
  items: readonly RoleElement[],
  ctx: { levelId: string; log: LevelIssueLog }
): TerrainRead {
  const read: TerrainRead = { pieces: [], els: [], objects: [] };
  let ordinal = 0;
  for (const item of ofRole(items, "terrain", "object")) {
    if (item.role === "object") {
      ordinal += 1;
      addObject(item, { ...ctx, ordinal }, read);
      continue;
    }
    const shape = readShape(item, ctx.log);
    if (!shape) continue;
    read.pieces.push({ shape, ...readTerrainRefs(item, ctx.log) });
    read.els.push(item.el);
  }
  return read;
}

/** The part of `rect` inside `world`; null when they don't overlap. */
function clipRect(world: Rect, rect: Rect): Rect | null {
  const x = Math.max(world.x, rect.x);
  const y = Math.max(world.y, rect.y);
  const w = Math.min(world.x + world.w, rect.x + rect.w) - x;
  const h = Math.min(world.y + world.h, rect.y + rect.h) - y;
  return w > 0 && h > 0 ? { x, y, w, h } : null;
}

/**
 * One bounds rect inside the world. W18 (was the error E4, forgiving-import): none or none
 * readable → the whole world; several → the first readable; sticking out → clipped to the world.
 */
function readBounds(
  items: readonly RoleElement[],
  world: { w: number; h: number },
  log: LevelIssueLog
): Rect {
  const worldRect: Rect = { x: 0, y: 0, ...world };
  const candidates = ofRole(items, "bounds");
  const readable = candidates.flatMap((item) => {
    const rect = readRect(item, log);
    return rect ? [{ item, rect }] : [];
  });
  const first = readable[0];
  const worldText = `the world (0 0 ${world.w} ${world.h})`;
  if (!first) {
    addWarning(log, "W18", `No usable bounds rect; using ${worldText}.`);
    return worldRect;
  }
  if (candidates.length > 1) {
    addWarning(
      log,
      "W18",
      `Found ${candidates.length} bounds rects; using ${first.item.name}, the others are ignored.`
    );
  }
  if (rectContainsRect(worldRect, first.rect)) return first.rect;
  const clipped = clipRect(worldRect, first.rect);
  addWarning(
    log,
    "W18",
    `${first.item.name} lies outside the viewBox; using ${clipped ? "its part inside" : worldText}.`
  );
  return clipped ?? worldRect;
}

interface PointContext {
  bounds: Rect;
  terrain: readonly TerrainPiece[];
  log: LevelIssueLog;
}

/** W5: points outside bounds (and spawns inside terrain) are skipped. */
function placedPoint(item: RoleElement, ctx: PointContext): Vec2 | null {
  const at = readPoint(item, ctx.log);
  if (!at) return null;
  checkPointBehavior(item, ctx.log);
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

/** W19: no valid spawn → spawns above the terrain; E5 only when there is no room for one. */
function placeFallbackSpawns(ctx: PointContext): Vec2[] {
  const spawns = fallbackSpawns(
    ctx.terrain.map((piece) => piece.shape),
    ctx.bounds
  );
  if (spawns.length === 0) {
    addError(
      ctx.log,
      "E5",
      'No valid spawn point, and no room above the terrain to place one: add <circle data-role="spawn"> points.'
    );
    return spawns;
  }
  const where = spawns.map((p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`).join(", ");
  addWarning(
    ctx.log,
    "W19",
    `No valid spawn point; placed ${spawns.length} above the widest terrain at ${where}.`
  );
  return spawns;
}

function readSpawns(items: readonly RoleElement[], ctx: PointContext): Vec2[] {
  const spawns = ofRole(items, "spawn").flatMap((item) => placedPoint(item, ctx) ?? []);
  if (spawns.length === 0) return ctx.terrain.length > 0 ? placeFallbackSpawns(ctx) : spawns;
  if (spawns.length < RECOMMENDED_SPAWNS) {
    addWarning(
      ctx.log,
      "W6",
      `Only ${spawns.length} spawn point(s); ${RECOMMENDED_SPAWNS}-player rounds will share spawns.`
    );
  }
  return spawns;
}

/** W20 (was the error E7, forgiving-import): no drop point means no weapon crates. */
function readDrops(items: readonly RoleElement[], ctx: PointContext): LevelDrop[] {
  const drops = ofRole(items, "drop").flatMap((item) => {
    const at = placedPoint(item, ctx);
    return at ? [{ at }] : [];
  });
  if (drops.length === 0) {
    addWarning(
      ctx.log,
      "W20",
      'No valid drop point; no weapon crates fall on this level (add <circle data-role="drop"> for crates).'
    );
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
  "terrain" | "spawns" | "drops" | "collectibles" | "bounds" | "movers" | "objects"
>;

interface ContentArgs {
  root: Element;
  world: { w: number; h: number };
  cellSize: number;
  /** For objects' default seeds (level-objects D8). */
  levelId: string;
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
  return movers.map(({ mover }) => mover);
}

function readContent(args: ContentArgs): LevelContent {
  const { root, world, log } = args;
  const items = collectRoleElements(root, log);
  const terrainRead = readTerrain(items, { levelId: args.levelId, log });
  const terrain = terrainRead.pieces;
  if (terrain.length === 0) {
    addError(log, "E6", "No valid terrain: add at least one platform or destructible shape.");
  }
  const bounds = readBounds(items, world, log);
  const ctx: PointContext = { bounds, terrain, log };
  const spawns = readSpawns(items, ctx);
  const drops = readDrops(items, ctx);
  const collectibles = readCollectibles(items, ctx);
  const movers = readMovers(args, { items, terrain: terrainRead, spawns, bounds });
  const { objects } = terrainRead;
  return {
    terrain,
    spawns,
    drops,
    collectibles,
    bounds,
    ...(movers.length > 0 && { movers }),
    ...(objects.length > 0 && { objects }),
  };
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
  const content = readContent({
    root,
    world: worldSize,
    cellSize: settings.cellSize,
    levelId: meta.levelId,
    log,
  });
  if (log.errors.length > 0) return rejected(log);
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
