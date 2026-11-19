import type { GameTunables } from "@/shared/types/gameTunables.types";
import {
  eggSegments,
  bodyGlossSpot,
  helmetDome,
  type GlossSpot,
  type BlobMetrics,
  type ShapePoint,
} from "@/features/player/services/blobShapes";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Render-only crouch pose, "sink + settle, low" (owner, crouch-sink D1–D3). The helmet keeps its
 * shape: it sinks into the blob, whose top shortens so every part of it above the rim stays inside
 * the dome, while the whole blob drops and presses onto the ground. The jelly pushed out of the
 * helmet bulges under the rim so the body keeps `areaKeep` of its area; the feet vanish; the body
 * gloss slides onto the bulge's upper-left arc. Lengths are mockup units (u = r / 30) unless a
 * name says world units; outlines are torso space (body centre origin, y down). Pure TS: the
 * renderer only draws what this returns, and nothing feeds back into the sim.
 */
export type CrouchTunables = GameTunables["player"]["crouch"];

/** Where a blob's crouch stands this frame (all zero / one when standing). */
export interface CrouchSink {
  /** Crouch progress 0 (standing) … 1 (sunk). */
  k: number;
  /** How far the helmet has sunk into the blob (negative during the stand-up hop). */
  helmetSink: number;
  /** How far the whole blob has dropped toward the ground. */
  drop: number;
  /** Share of the solved bulge shown (it follows the sink a moment later). */
  bulge: number;
  /** Feet scale: 1 standing, 0 gone. */
  feetScale: number;
}

export const STANDING_SINK: Readonly<CrouchSink> = {
  k: 0,
  helmetSink: 0,
  drop: 0,
  bulge: 0,
  feetScale: 1,
};

/** True for the plain standing pose (nothing sunk, dropped or bent). */
const isStanding = (sink: CrouchSink): boolean =>
  sink.k === 0 && sink.helmetSink === 0 && sink.drop === 0;

/** Render clock of the last crouch press / release, kept per blob by the renderer. */
export interface CrouchClock {
  crouching: boolean;
  pressMs: number | null;
  releaseMs: number | null;
  /** The pose at the release; the stand-up eases from it. */
  from: CrouchSink;
}

/** The bulge follows the helmet this long after the press. */
const BULGE_LAG_SECONDS = 0.03;
/** Breathing fades in over this long once the settle is over. */
const BREATHE_FADE_SECONDS = 0.3;
/** The feet are gone this long after the press (owner, crouch-sink D2). */
const FEET_GONE_SECONDS = 0.06;
/** Standing up, the feet are back in full by this share of the way. */
const FEET_BACK_AT = 0.6;
/** Crouch progress past which the eyes slip under the dome. */
const EYES_UNDER_AT = 0.3;
/** A clock older than this counts as fully settled (keeps the trig finite). */
const LONG_AGO_SECONDS = 3600;

const clamp01 = (t: number): number => Math.max(0, Math.min(1, t));
const smoothstep = (t: number): number => {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
};
const easeOutCubic = (t: number): number => 1 - (1 - clamp01(t)) ** 3;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const createCrouchClock = (player: PlayerState): CrouchClock => ({
  crouching: player.crouching,
  pressMs: player.crouching ? Number.NEGATIVE_INFINITY : null,
  releaseMs: null,
  from: STANDING_SINK,
});

const elapsed = (sinceMs: number, nowMs: number): number =>
  Math.min(LONG_AGO_SECONDS, Math.max(0, nowMs - sinceMs) / 1000);

/** Sinking in: ease-out to the hold, overshoot settling, then slow breathing. */
function enterSink(t: number, c: CrouchTunables): CrouchSink {
  const k = easeOutCubic(t / c.sinkSeconds);
  const after = t - c.sinkSeconds;
  const settle =
    after < 0
      ? c.overshoot * k
      : c.overshoot *
        Math.exp(-after / (c.settleSeconds / 3.5)) *
        Math.cos(2 * Math.PI * c.settleHz * after);
  const held = after - c.settleSeconds;
  const breath =
    held > 0
      ? c.breathe *
        Math.sin(2 * Math.PI * c.breatheHz * held) *
        clamp01(held / BREATHE_FADE_SECONDS)
      : 0;
  const bulgeShown = easeOutCubic((t - BULGE_LAG_SECONDS) / (c.sinkSeconds * 0.9));
  return {
    k,
    helmetSink: c.helmetSink * k + settle + breath,
    drop: c.drop * k,
    bulge: clamp01(bulgeShown / Math.max(k, 0.01)),
    feetScale: 1 - smoothstep(t / FEET_GONE_SECONDS),
  };
}

/** Standing up from the pose at the release, with the helmet's hop. */
function exitSink(t: number, c: CrouchTunables, from: CrouchSink): CrouchSink {
  const left = 1 - smoothstep(t / c.riseSeconds);
  const k = from.k * left;
  return {
    k,
    helmetSink:
      from.helmetSink * left - c.hop * from.k * Math.sin(Math.PI * clamp01(t / c.hopSeconds)),
    drop: from.drop * left,
    bulge: from.bulge * (1 - easeOutCubic(t / (c.riseSeconds * 0.5))),
    feetScale: 1 - smoothstep(k / FEET_BACK_AT),
  };
}

const SINK_KEYS = Object.keys(STANDING_SINK) as (keyof CrouchSink)[];

const mixSink = (a: CrouchSink, b: CrouchSink, t: number): CrouchSink =>
  Object.fromEntries(
    SINK_KEYS.map((key) => [key, lerp(a[key], b[key], t)])
  ) as unknown as CrouchSink;

/** Sinking in; a press during the stand-up eases from that pose instead of snapping. */
function pressedSink(t: number, c: CrouchTunables, from: CrouchSink): CrouchSink {
  const sink = enterSink(t, c);
  return from === STANDING_SINK ? sink : mixSink(from, sink, smoothstep(t / c.sinkSeconds));
}

/** The crouch pose at `nowMs` (standing once the stand-up is over). */
export function crouchSink(clock: CrouchClock, crouch: CrouchTunables, nowMs: number): CrouchSink {
  if (clock.pressMs !== null) return pressedSink(elapsed(clock.pressMs, nowMs), crouch, clock.from);
  if (clock.releaseMs === null) return STANDING_SINK;
  const t = elapsed(clock.releaseMs, nowMs);
  if (t >= Math.max(crouch.riseSeconds, crouch.hopSeconds)) return STANDING_SINK;
  return exitSink(t, crouch, clock.from);
}

/** Follows the sim's `crouching`: a press starts the sink, a release the stand-up. */
export function noteCrouch(
  clock: CrouchClock,
  frame: { player: PlayerState; crouch: CrouchTunables; nowMs: number }
): void {
  const { player, crouch, nowMs } = frame;
  if (player.crouching === clock.crouching) return;
  const now = crouchSink(clock, crouch, nowMs);
  clock.from = isStanding(now) ? STANDING_SINK : now;
  if (player.crouching) {
    clock.pressMs = nowMs;
    clock.releaseMs = null;
  } else {
    clock.pressMs = null;
    clock.releaseMs = nowMs;
  }
  clock.crouching = player.crouching;
}

// ── Body outline ─────────────────────────────────────────────────────────────

/** Egg samples per cubic curve (four curves). */
const SAMPLES_PER_CURVE = 24;
/** The bulge grows to full over this many u below the rim. */
const BULGE_RAMP = 14;
/** A body point may sit this close (u) to the dome's outline. */
const FIT_TOLERANCE = 0.3;
/** Solved tables step (u of helmet sink). */
const TABLE_STEP = 0.25;
/** The ground spreads the pressed jelly sideways by this share of the press depth over r. */
const GROUND_SPREAD = 0.9;

/** One coordinate of a cubic curve at `t`, from its four control values. */
const cubicAt = ([a, b, c, d]: readonly [number, number, number, number], t: number): number =>
  (1 - t) ** 3 * a + 3 * t * (1 - t) ** 2 * b + 3 * t * t * (1 - t) * c + t ** 3 * d;

const eggCache = new Map<number, readonly ShapePoint[]>();

/** The egg outline sampled once per body size (it only depends on r). */
function eggPoints(r: number): readonly ShapePoint[] {
  const cached = eggCache.get(r);
  if (cached) return cached;
  const points: ShapePoint[] = [];
  for (const [p0, p1, p2, p3] of eggSegments(r)) {
    for (let i = 0; i < SAMPLES_PER_CURVE; i += 1) {
      const t = i / SAMPLES_PER_CURVE;
      points.push([
        cubicAt([p0[0], p1[0], p2[0], p3[0]], t),
        cubicAt([p0[1], p1[1], p2[1], p3[1]], t),
      ]);
    }
  }
  eggCache.set(r, points);
  return points;
}

/** The egg with its upper half scaled by `topScale` and the bulge `bulge` below the rim `rimY`. */
function shapedBody(
  m: BlobMetrics,
  shape: { topScale: number; bulge: number; rimY: number }
): ShapePoint[] {
  const ramp = BULGE_RAMP * m.u;
  return eggPoints(m.r).map(([x, y]): ShapePoint => {
    const sy = y < 0 ? y * shape.topScale : y;
    const sx = sy > shape.rimY ? x * (1 + shape.bulge * smoothstep((sy - shape.rimY) / ramp)) : x;
    return [sx, sy];
  });
}

/**
 * Half-width of the dome at height `y` (torso space) with the helmet sunk `sink` world units, or
 * null below the rim line (no limit there).
 */
export function domeHalfWidth(m: BlobMetrics, y: number, sink: number): number | null {
  const [[, rim], [, peak], , [half]] = helmetDome(m);
  const rimY = rim + sink;
  const peakY = peak + sink;
  if (y > rimY) return null;
  const apex = 0.25 * rimY + 0.75 * peakY;
  if (y < apex) return 0;
  let lo = 0;
  let hi = 0.5;
  for (let i = 0; i < 30; i += 1) {
    const t = (lo + hi) / 2;
    const yt = rimY * ((1 - t) ** 3 + t ** 3) + peakY * 3 * t * (1 - t);
    if (yt > y) lo = t;
    else hi = t;
  }
  const t = (lo + hi) / 2;
  return half * ((1 - t) ** 2 * (1 + 2 * t) - t * t * (3 - 2 * t));
}

/** True when every point at or above the rim line lies inside the dome (sunk `sink` world units). */
export function fitsHelmet(points: readonly ShapePoint[], m: BlobMetrics, sink: number): boolean {
  const tolerance = FIT_TOLERANCE * m.u;
  return points.every(([x, y]) => {
    const width = domeHalfWidth(m, y, sink);
    return width === null || Math.abs(x) <= width + tolerance;
  });
}

/** Shoelace area of a closed outline. */
export function outlineArea(points: readonly ShapePoint[]): number {
  let twice = 0;
  points.forEach(([x, y], i) => {
    const [nx, ny] = points[(i + 1) % points.length]!;
    twice += x * ny - nx * y;
  });
  return Math.abs(twice) / 2;
}

interface CrouchFit {
  /** Per sink step: the largest top scale that fits the dome, and the bulge that keeps the area. */
  topScale: number[];
  bulge: number[];
}

const fitCache = new Map<string, CrouchFit>();

function bisect(test: (value: number) => boolean, range: { lo: number; hi: number }): number {
  let { lo, hi } = range;
  for (let i = 0; i < 18; i += 1) {
    const mid = (lo + hi) / 2;
    if (test(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

function solveStep(
  m: BlobMetrics,
  step: { sinkUnits: number; areaKeep: number; standing: number }
) {
  const { sinkUnits, areaKeep, standing } = step;
  const rimY = m.helmet.rim + sinkUnits * m.u;
  const sink = sinkUnits * m.u;
  const fitsAt = (topScale: number): boolean =>
    fitsHelmet(shapedBody(m, { topScale, bulge: 0, rimY }), m, sink);
  const topScale = fitsAt(1) ? 1 : bisect(fitsAt, { lo: 0.1, hi: 1 });
  const short = (bulge: number): boolean =>
    outlineArea(shapedBody(m, { topScale, bulge, rimY })) / standing < areaKeep;
  const bulge = short(0) ? bisect(short, { lo: 0, hi: 1.5 }) + 0.002 : 0;
  return { topScale, bulge };
}

/** Top scales and bulges for every sink up to the deepest the tunables reach (cached by size). */
function crouchFit(m: BlobMetrics, crouch: CrouchTunables): CrouchFit {
  const deepest = crouch.helmetSink + crouch.overshoot + crouch.breathe + 1;
  const key = `${m.r}:${crouch.areaKeep}:${deepest}`;
  const cached = fitCache.get(key);
  if (cached) return cached;
  const fit: CrouchFit = { topScale: [], bulge: [] };
  const standing = outlineArea(eggPoints(m.r));
  for (let i = 0; i * TABLE_STEP <= deepest; i += 1) {
    const step = solveStep(m, { sinkUnits: i * TABLE_STEP, areaKeep: crouch.areaKeep, standing });
    fit.topScale.push(step.topScale);
    fit.bulge.push(step.bulge);
  }
  fitCache.set(key, fit);
  return fit;
}

/** Solves the crouch tables for this body size ahead of the first crouch (no stutter then). */
export const warmCrouchFit = (m: BlobMetrics, crouch: CrouchTunables): void => {
  crouchFit(m, crouch);
};

/** Table value at `sinkUnits`, taking the safer neighbour (`pick` = Math.min or Math.max). */
function tableAt(
  table: readonly number[],
  sinkUnits: number,
  pick: (a: number, b: number) => number
) {
  const i = Math.min(table.length - 1, Math.max(0, Math.floor(sinkUnits / TABLE_STEP)));
  return pick(table[i]!, table[Math.min(table.length - 1, i + 1)]!);
}

/** Presses the outline's bottom onto the ground line, spreading the jelly over it. */
function pressOnGround(points: ShapePoint[], m: BlobMetrics): ShapePoint[] {
  const ground = m.bodyLift;
  let deepest = -Infinity;
  for (const [, y] of points) deepest = Math.max(deepest, y);
  const press = deepest - ground;
  if (press <= 0) return points;
  const zone = 3 * press;
  const spread = GROUND_SPREAD * (press / m.r);
  return points.map(
    ([x, y]): ShapePoint =>
      y > ground - zone
        ? [x * (1 + spread * smoothstep((y - ground + zone) / zone)), Math.min(y, ground)]
        : [x, y]
  );
}

/** The crouched body outline in torso space, or null while standing (draw the plain egg). */
export function crouchOutline(
  m: BlobMetrics,
  frame: { sink: CrouchSink; crouch: CrouchTunables }
): ShapePoint[] | null {
  const { sink, crouch } = frame;
  if (isStanding(sink)) return null;
  const fit = crouchFit(m, crouch);
  const sinkUnits = Math.max(0, sink.helmetSink);
  const shaped = shapedBody(m, {
    topScale: tableAt(fit.topScale, sinkUnits, Math.min),
    bulge: tableAt(fit.bulge, sinkUnits, Math.max) * sink.bulge,
    rimY: m.helmet.rim + sinkUnits * m.u,
  });
  const dropped = shaped.map(([x, y]): ShapePoint => [x, y + sink.drop * m.u]);
  return pressOnGround(dropped, m);
}

// ── Face and gloss ───────────────────────────────────────────────────────────

/** How far the helmet sits under its standing place (world units): sink plus drop. */
export const crouchHelmetDrop = (m: BlobMetrics, sink: CrouchSink): number =>
  (sink.helmetSink + sink.drop) * m.u;

/** The helmet's rim line this frame (torso space). */
export const crouchRimY = (m: BlobMetrics, sink: CrouchSink): number =>
  m.helmet.rim + crouchHelmetDrop(m, sink);

/** Eye centre height (torso space, before the aim offset): the rim covers the top half when sunk. */
export const crouchEyeY = (m: BlobMetrics, sink: CrouchSink): number =>
  crouchRimY(m, sink) + lerp(9, 3, sink.k) * m.u;

export const eyesUnderHelmet = (sink: CrouchSink): boolean => sink.k > EYES_UNDER_AT;

/**
 * The body gloss while crouched (owner, crouch-sink D3): it slides onto the bulge's upper-left
 * arc, 8 u under the rim, 6 u inside the outline, its long axis along the arc, as if it reflects
 * the sky there.
 */
export function crouchGloss(
  m: BlobMetrics,
  frame: { sink: CrouchSink; outline: readonly ShapePoint[] | null }
): GlossSpot {
  const standing = bodyGlossSpot(m);
  const { sink, outline } = frame;
  if (!outline || sink.k <= 0) return standing;
  const targetY = crouchRimY(m, sink) + 8 * m.u;
  let best = 0;
  outline.forEach(([x, y], i) => {
    if (x < 0 && Math.abs(y - targetY) < Math.abs(outline[best]![1] - targetY)) best = i;
  });
  const n = outline.length;
  const [ax, ay] = outline[(best + n - 2) % n]!;
  const [bx, by] = outline[(best + 2) % n]!;
  const [dx, dy] = by >= ay ? [bx - ax, by - ay] : [ax - bx, ay - by];
  const [px, py] = outline[best]!;
  return {
    x: lerp(standing.x, px + 6 * m.u, sink.k),
    y: lerp(standing.y, py + 1.5 * m.u, sink.k),
    rotation: lerp(standing.rotation, Math.atan2(-dx, dy), sink.k),
  };
}
