import type { Rect, Shape2D, Vec2 } from "@/shared/types/gameGeometry.types";
import type { LevelMotion, MotionDirection, MotionPose } from "@/shared/types/levelMotion.types";
import {
  MOTION_DEFAULTS,
  MOTION_KINDS,
  MOTION_LIMITS,
  isMotionPivotName,
  motionPeakSpeed,
  motionPose,
  pivotPoint,
  posePoint,
  unposePoint,
  type MotionPivotName,
} from "@/shared/utils/levelMotion";
import { shapeBounds, shapeOutlinePoints, shapeSignedDistance } from "@/shared/utils/shapeGeometry";
import { hasCatalogEntry } from "@/features/content-catalog/api/contentCatalogApi";
import { CATALOG_ID_RE } from "@/features/level-file/services/levelFileRoot";
import type { LevelMover, TerrainPiece } from "@/features/level/api/levelApi";
import { parsePlainNumber } from "@/features/level-file/services/levelFileGeometry";
import { addWarning, type LevelIssueLog } from "@/features/level-file/services/levelFileIssues";
import type { RoleElement } from "@/features/level-file/types/levelFile.types";

/**
 * Moving parts in a level file (LEVEL_FORMAT § 11): `data-motion` on a `<g>` of terrain shapes.
 * W12 = the motion text (bad → the group stays still; clamped or off-grid → noted), W13 = what
 * sits inside a moving group. Sweep checks (W14) live in `levelFileMotionSweep`.
 */

/** A motion without its timing (distributes over the union). */
type MotionShape = LevelMotion extends infer M
  ? M extends LevelMotion
    ? Omit<M, "periodS" | "phase">
    : never
  : never;

interface MotionTokens {
  kind: string;
  pairs: Vec2[];
  numbers: number[];
  periodS?: number;
  phase?: number;
  pivot?: MotionPivotName;
  direction?: MotionDirection;
}

/** A parsed `data-motion`: the motion and its pivot, plus non-fatal notes; or why it failed. */
export type MotionParse =
  | { ok: true; motion: LevelMotion; pivot: MotionPivotName; notes: string[] }
  | { ok: false; reason: string };

const PERIOD_RE = /^(\d+(?:\.\d+)?|\.\d+)s$/;

function readPair(token: string): Vec2 | null {
  const parts = token.split(",");
  if (parts.length !== 2) return null;
  const x = parsePlainNumber(parts[0]!);
  const y = parsePlainNumber(parts[1]!);
  return x === null || y === null ? null : { x, y };
}

/** Timing, pivot and direction tokens; false when the token is none of them. */
function readOptionToken(token: string, out: MotionTokens): boolean {
  const period = PERIOD_RE.exec(token);
  if (period) out.periodS = Number(period[1]);
  else if (token.startsWith("@") && parsePlainNumber(token.slice(1)) !== null) {
    out.phase = Number(token.slice(1));
  } else if (isMotionPivotName(token)) out.pivot = token;
  else if (token === "cw" || token === "ccw") out.direction = token === "cw" ? 1 : -1;
  else return false;
  return true;
}

/** Reads one token into `out`; false when the token means nothing. */
function readToken(token: string, out: MotionTokens): boolean {
  if (readOptionToken(token, out)) return true;
  if (token.includes(",")) {
    const pair = readPair(token);
    if (pair) out.pairs.push(pair);
    return pair !== null;
  }
  const n = parsePlainNumber(token);
  if (n !== null) out.numbers.push(n);
  return n !== null;
}

function tokenize(raw: string): MotionTokens | string {
  const [kind = "", ...rest] = raw.trim().toLowerCase().split(/\s+/);
  if (!(MOTION_KINDS as readonly string[]).includes(kind)) {
    return `"${kind}" is not a motion; use ${MOTION_KINDS.join(", ")}`;
  }
  const out: MotionTokens = { kind, pairs: [], numbers: [] };
  const bad = rest.find((token) => !readToken(token, out));
  return bad === undefined ? out : `"${bad}" is not understood`;
}

const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? "" : "s"}`;

function slideMotion({ pairs, numbers }: MotionTokens): MotionShape | string {
  const offset = pairs[0];
  if (pairs.length !== 1 || !offset || numbers.length > 0) {
    return `slide takes one "dx,dy" offset (got ${plural(pairs.length, "offset")})`;
  }
  return { kind: "slide", offset };
}

function pathMotion({ pairs, numbers }: MotionTokens): MotionShape | string {
  if (pairs.length === 0 || numbers.length > 0) return 'path takes "dx,dy" offsets only';
  return { kind: "path", offsets: pairs };
}

function spinMotion({ pairs, numbers, direction = 1 }: MotionTokens): MotionShape | string {
  if (pairs.length > 0 || numbers.length > 0) return "spin takes no offset or angle";
  return { kind: "spin", direction };
}

function swingMotion({ pairs, numbers, direction = 1 }: MotionTokens): MotionShape | string {
  const degrees = numbers[0];
  if (pairs.length > 0 || numbers.length !== 1 || degrees === undefined) {
    return "swing takes one angle in degrees";
  }
  if (degrees <= 0 || degrees > MOTION_LIMITS.maxSwingDegrees) {
    return `swing angle must be above 0 and at most ${MOTION_LIMITS.maxSwingDegrees}`;
  }
  return { kind: "swing", degrees, direction };
}

const KIND_READERS: Record<string, (t: MotionTokens) => MotionShape | string> = {
  slide: slideMotion,
  path: pathMotion,
  spin: spinMotion,
  swing: swingMotion,
};

/** The kind-specific part of the motion, or why the arguments don't fit the kind. */
const kindMotion = (t: MotionTokens): MotionShape | string => KIND_READERS[t.kind]!(t);

function clampedPeriod(periodS: number, notes: string[]): number {
  const { minPeriodS, maxPeriodS } = MOTION_LIMITS;
  const clamped = Math.min(maxPeriodS, Math.max(minPeriodS, periodS));
  if (clamped !== periodS)
    notes.push(`period ${periodS}s is outside ${minPeriodS}–${maxPeriodS}s; using ${clamped}s`);
  return clamped;
}

function offGridNote(motion: LevelMotion, cellSize: number): string | null {
  const offsets =
    motion.kind === "slide" ? [motion.offset] : motion.kind === "path" ? motion.offsets : [];
  const off = offsets.find((o) => o.x % cellSize !== 0 || o.y % cellSize !== 0);
  return off
    ? `offset ${off.x},${off.y} is off the ${cellSize}-unit grid; snap it so parts line up`
    : null;
}

/** Parses a `data-motion` value (grammar: LEVEL_FORMAT § 11). */
export function parseMotionSpec(raw: string, cellSize: number): MotionParse {
  const tokens = tokenize(raw);
  if (typeof tokens === "string") return { ok: false, reason: tokens };
  const shape = kindMotion(tokens);
  if (typeof shape === "string") return { ok: false, reason: shape };
  const notes: string[] = [];
  const periodS = clampedPeriod(tokens.periodS ?? MOTION_DEFAULTS.periodS, notes);
  const phase = (((tokens.phase ?? MOTION_DEFAULTS.phase) % 1) + 1) % 1;
  const motion = { ...shape, periodS, phase } as LevelMotion;
  const grid = offGridNote(motion, cellSize);
  if (grid) notes.push(grid);
  const fallbackPivot =
    motion.kind === "swing" ? MOTION_DEFAULTS.pivot.swing : MOTION_DEFAULTS.pivot.spin;
  return { ok: true, motion, pivot: tokens.pivot ?? fallbackPivot, notes };
}

/** Bounding box of several pieces. */
function piecesBounds(pieces: readonly TerrainPiece[]): Rect {
  const boxes = pieces.map((piece) => shapeBounds(piece.shape));
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

export interface MoverContext {
  root: Element;
  /** Role elements that passed the structural checks. */
  items: readonly RoleElement[];
  terrain: readonly TerrainPiece[];
  /** The element of each terrain piece (same order as `terrain`). */
  terrainEls: readonly Element[];
  cellSize: number;
  log: LevelIssueLog;
}

/** A mover plus the readable name its warnings use. */
export interface NamedMover {
  mover: LevelMover;
  name: string;
}

function moverName(group: Element, ordinal: number): string {
  const ref = group.getAttribute("id") || group.getAttribute("data-label");
  return ref ? `moving part "${ref}"` : `moving part #${ordinal}`;
}

/** W13: non-terrain roles inside a moving group (a part may be any material, mover-materials D1). */
function warnContents(
  part: { group: Element; name: string; indices: readonly number[] },
  ctx: MoverContext
): void {
  const { group, name } = part;
  for (const item of ctx.items) {
    if (item.role !== "terrain" && group.contains(item.el)) {
      addWarning(
        ctx.log,
        "W13",
        `${item.name} is inside ${name}; only terrain moves, it stays still.`
      );
    }
  }
}

function readMover(group: Element, name: string, ctx: MoverContext): LevelMover | null {
  const parsed = parseMotionSpec(group.getAttribute("data-motion") ?? "", ctx.cellSize);
  if (!parsed.ok) {
    addWarning(ctx.log, "W12", `${name}: data-motion ${parsed.reason}; the part stays still.`);
    return null;
  }
  for (const note of parsed.notes) addWarning(ctx.log, "W12", `${name}: ${note}.`);
  const terrainIndices = ctx.terrainEls.flatMap((el, i) => (group.contains(el) ? [i] : []));
  warnContents({ group, name, indices: terrainIndices }, ctx);
  if (terrainIndices.length === 0) {
    addWarning(ctx.log, "W12", `${name} holds no terrain shape; ignored.`);
    return null;
  }
  const box = piecesBounds(terrainIndices.map((i) => ctx.terrain[i]!));
  const sounds = readPartSounds(group, name, ctx.log);
  return {
    motion: parsed.motion,
    pivot: pivotPoint(box, parsed.pivot),
    terrainIndices,
    ...(sounds && { sounds }),
  };
}

/** Part sound attributes on a moving group (moving-parts B2): `data-<key>-sound`. */
const PART_SOUND_ATTRS = { move: "data-move-sound", end: "data-end-sound" } as const;

/**
 * The author-declared sounds of a moving part (silent by default, owner B2): catalog sound IDs.
 * An unknown or malformed ID warns W4 and that sound stays off.
 */
function readPartSounds(
  group: Element,
  name: string,
  log: LevelIssueLog
): { move?: string; end?: string } | null {
  const sounds: { move?: string; end?: string } = {};
  for (const key of ["move", "end"] as const) {
    const attr = PART_SOUND_ATTRS[key];
    const raw = group.getAttribute(attr)?.trim();
    if (!raw) continue;
    if (CATALOG_ID_RE.test(raw) && hasCatalogEntry("sound", raw)) sounds[key] = raw;
    else addWarning(log, "W4", `${name}: ${attr}="${raw}" is not a known sound; left out.`);
  }
  return sounds.move || sounds.end ? sounds : null;
}

/** True when a `<g data-motion>` between `group` and the root encloses it. */
function insideMover(group: Element, root: Element): boolean {
  for (let node = group.parentElement; node && node !== root; node = node.parentElement) {
    if (node.localName === "g" && node.hasAttribute("data-motion")) return true;
  }
  return false;
}

/** Every outermost `<g data-motion>` as a mover (at most `MOTION_LIMITS.maxMovers`). */
export function collectMovers(ctx: MoverContext): NamedMover[] {
  const movers: NamedMover[] = [];
  // Only <g> moves; data-motion on a role element is reported there as W10.
  const groups = Array.from(ctx.root.querySelectorAll("g[data-motion]"));
  groups.forEach((group, i) => {
    const name = moverName(group, i + 1);
    if (insideMover(group, ctx.root)) {
      addWarning(
        ctx.log,
        "W13",
        `${name} sits inside another moving part; its own motion is ignored.`
      );
      return;
    }
    if (movers.length >= MOTION_LIMITS.maxMovers) {
      addWarning(
        ctx.log,
        "W12",
        `${name}: more than ${MOTION_LIMITS.maxMovers} moving parts; it stays still.`
      );
      return;
    }
    const mover = readMover(group, name, ctx);
    if (mover) movers.push({ mover, name });
  });
  return movers;
}

// ---- W14: where a part goes over one cycle ----
// The checks an author can't see without running the level: the part leaves the bounds, runs
// into static terrain, sweeps over a spawn, or moves faster than a player can ride. The level
// still loads; each warning names the part and the first sampled time it happens.

/** Poses sampled per cycle. */
const SAMPLES = 48;
/** Spacing of edge points (world units). */
const OUTLINE_STEP = 8;
/** Deeper than this inside static terrain counts as running into it (touching does not). */
const OVERLAP_DEPTH = 2;

export interface SweepContext {
  movers: readonly NamedMover[];
  terrain: readonly TerrainPiece[];
  spawns: readonly Vec2[];
  bounds: Rect;
  log: LevelIssueLog;
}

interface PartGeometry {
  shapes: Shape2D[];
  /** Edge points at rest. */
  outline: Vec2[];
}

type SweepProblem = "bounds" | "terrain" | "spawn";

const SWEEP_MESSAGES: Record<SweepProblem, string> = {
  bounds: "leaves the bounds",
  terrain: "runs into static terrain",
  spawn: "sweeps over a spawn point",
};

const insideRect = (r: Rect, p: Vec2): boolean =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

const deepInside = (shapes: readonly Shape2D[], p: Vec2, depth: number): boolean =>
  shapes.some((shape) => shapeSignedDistance(shape, p) > depth);

const geometryOf = (shapes: Shape2D[]): PartGeometry => ({
  shapes,
  outline: shapes.flatMap((shape) => shapeOutlinePoints(shape, OUTLINE_STEP)),
});

interface PoseCheck {
  pose: MotionPose;
  pivot: Vec2;
  part: PartGeometry;
  statics: PartGeometry;
  ctx: SweepContext;
}

function problemsAt(check: PoseCheck): SweepProblem[] {
  const { pose, pivot, part, statics, ctx } = check;
  const moved = part.outline.map((p) => posePoint(pose, pivot, p));
  const problems: SweepProblem[] = [];
  if (moved.some((p) => !insideRect(ctx.bounds, p))) problems.push("bounds");
  const hitsStatic =
    moved.some((p) => deepInside(statics.shapes, p, OVERLAP_DEPTH)) ||
    statics.outline.some((p) =>
      deepInside(part.shapes, unposePoint(pose, pivot, p), OVERLAP_DEPTH)
    );
  if (hitsStatic) problems.push("terrain");
  const coversSpawn = ctx.spawns.some((s) =>
    deepInside(part.shapes, unposePoint(pose, pivot, s), -MOTION_LIMITS.spawnClearance)
  );
  if (coversSpawn) problems.push("spawn");
  return problems;
}

function warnSpeed(named: NamedMover, part: PartGeometry, log: LevelIssueLog): void {
  const { pivot, motion } = named.mover;
  const reach = Math.max(0, ...part.outline.map((p) => Math.hypot(p.x - pivot.x, p.y - pivot.y)));
  const speed = motionPeakSpeed(motion, reach);
  if (speed <= MOTION_LIMITS.rideSpeed) return;
  addWarning(
    log,
    "W14",
    `${named.name} moves up to ${Math.round(speed)} units/s, faster than a player can ride (${MOTION_LIMITS.rideSpeed}); make the period longer or the move shorter.`
  );
}

/** W14 for every mover: sweep problems at their first sampled time, then ride speed. */
export function checkMoverSweeps(ctx: SweepContext): void {
  const moving = new Set(ctx.movers.flatMap(({ mover }) => mover.terrainIndices));
  const statics = geometryOf(
    ctx.terrain.filter((_, i) => !moving.has(i)).map((piece) => piece.shape)
  );
  for (const named of ctx.movers) {
    const part = geometryOf(named.mover.terrainIndices.map((i) => ctx.terrain[i]!.shape));
    const firstAt = new Map<SweepProblem, number>();
    const { motion, pivot } = named.mover;
    for (let k = 0; k < SAMPLES; k += 1) {
      const t = (k * motion.periodS) / SAMPLES;
      for (const problem of problemsAt({
        pose: motionPose(motion, t),
        pivot,
        part,
        statics,
        ctx,
      })) {
        if (!firstAt.has(problem)) firstAt.set(problem, t);
      }
    }
    for (const [problem, t] of firstAt) {
      const message = `${named.name} ${SWEEP_MESSAGES[problem]} (first at ${t.toFixed(1)} s).`;
      addWarning(ctx.log, "W14", message);
    }
    warnSpeed(named, part, ctx.log);
  }
}
