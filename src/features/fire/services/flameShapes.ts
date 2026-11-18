import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { rowRunSlabs } from "@/shared/utils/blockSlabs";
import type { TorchSpray } from "@/features/fire/types/fire.types";

/**
 * Flame geometry (owner fire-visuals D1–D3, "Sticker flames"): pure shapes the fire renderer
 * fills and outlines. Terrain flames are pointed tongues; the torch spray is a neck that opens
 * to about half the hit cone and ends in a head of rolling lobes, lifting a little and shedding
 * flames upward. The shapes never change what the torch lights: they are fitted inside the
 * rays the sim cast.
 */
export const FLAME_LOOK = {
  spray: {
    /** Where the flame leaves the nozzle: units along the aim from the helmet point. */
    nozzleReach: 15,
    /** Neck half-width as a share of the hit cone's half-width at the same distance. */
    neckWidth: 0.45,
    /** Head radius as a share of the hit cone's half-width at the spray's end. */
    headRadius: 0.62,
    /** Where the head sits and where the neck swells into it (0 nozzle … 1 end). */
    headAt: 0.78,
    bulge: [0.45, 0.82],
    /** Upward lift at the end, as a share of the spray's length (grows with distance²). */
    lift: 0.13,
    lobes: 6,
    /** Flames peeling off the top at any time. */
    shed: 5,
    /** Grow-in on spray start and the head's puff on release (juice windows squash / effect). */
    growSeconds: 0.12,
    releaseSeconds: 0.3,
  },
  terrain: {
    /** A flame reaches full size this long after its sample catches. */
    catchSeconds: 0.12,
    /** How much smaller it is by burn-out (1 = gone). */
    fade: 0.65,
    /** Taller where the sample above is air. */
    openScale: 1.45,
  },
  /** A fire drawn as one shape (owner fire-clusters D1: "Big flames", taller in the middle). */
  cluster: {
    /** Body slabs: grown past their blocks and rounded, as shares of the block size. */
    bodyGrow: 0.22,
    bodyRadius: 0.55,
    hotRadius: 0.5,
    /** A block glows amber inside for this share of its burn. */
    hotUntil: 0.6,
    /** A lone flame's half-width as a share of the block size. */
    flameWidth: 0.7,
    /** Extra width and height a flame gains per neighbour flame it takes in (0 … 2 of them). */
    poolWidth: 0.45,
    poolHeight: 0.3,
    /** Extra height per burning block around it, counted up to `crowdCap`. */
    crowdGain: 0.08,
    crowdCap: 5,
    /** Height toward the cluster's middle: base + gain × blocks from its nearer end, up to reach. */
    centreBase: 0.78,
    centreGain: 0.13,
    centreReach: 4,
    /** Each flame's own fixed size: [smallest, range] of its height (in blocks) and width. */
    heightJitter: [1, 0.7],
    widthJitter: [0.9, 0.2],
  },
  /** A burn-out smoke puff's life (juice window linger). */
  smokeSeconds: 0.45,
} as const;

/** A pointed flame standing on (x, y): half-width at the base, height, sideways lean of the tip. */
export interface Tongue {
  x: number;
  y: number;
  width: number;
  height: number;
  sway: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

/** One colour layer of a spray: its neck polygon (flat x, y list) and its head lobes. */
export interface SprayLayer {
  neck: number[];
  lobes: Circle[];
}

export interface SprayFlame {
  /** Outer, middle and core layer, back to front. */
  layers: [SprayLayer, SprayLayer, SprayLayer];
  /** Flames peeling off the top; `fade` runs 0 → 1 over each one's life. */
  shed: (Tongue & { fade: number })[];
  /** A flare at each ray that met terrain. */
  splashes: Circle[];
  head: Vec2;
  headRadius: number;
}

const TAU = Math.PI * 2;
const NECK_STEPS = 16;
/** Width and length of each layer against the outer one, and its lobes' scale (0 = none). */
const LAYERS = [
  { width: 1, length: 1, lobes: 1 },
  { width: 0.62, length: 0.86, lobes: 0.6 },
  { width: 0.3, length: 0.55, lobes: 0 },
] as const;

/** Deterministic 0..1 noise (no RNG in render). */
const noise = (seed: number): number => {
  const s = Math.sin(seed * 127.1) * 43758.5453;
  return s - Math.floor(s);
};

const smooth = (x: number): number => {
  const k = Math.min(1, Math.max(0, x));
  return k * k * (3 - 2 * k);
};

/** Flame size 0..1 by time since the sample caught: quick rise, then a slow shrink to burn-out. */
export function flameEnvelope(age: number, burnSeconds: number): number {
  const { catchSeconds, fade } = FLAME_LOOK.terrain;
  const rise = Math.min(1, Math.max(0, age / catchSeconds));
  return rise * (1 - fade * Math.min(1, Math.max(0, age / burnSeconds)));
}

/** One 2 × 2 block of burning samples: its block column and row, centre, age and flicker key. */
export interface FlameBlock {
  bx: number;
  by: number;
  x: number;
  y: number;
  /** Seconds since the block's first burning sample caught. */
  age: number;
  /** The sample above the block is air: the flame stands free. */
  open: boolean;
  /** `by * stride + bx`: the block's place in the cluster and its fixed flicker seed. */
  key: number;
}

/** A rounded slab of fire body (top-left corner, width, height). */
export interface Slab {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** A fire as one shape: body slabs, the hot inside, and the flames on its top edge. */
export interface FireCluster {
  body: Slab[];
  hot: Slab[];
  flames: (Tongue & { age: number })[];
}

export interface ClusterLook {
  /** Width of one block in world units. */
  size: number;
  /** Blocks per row in `FlameBlock.key`. */
  stride: number;
  timeSeconds: number;
  burnSeconds: number;
}

interface ClusterPass {
  blocks: ReadonlyMap<number, FlameBlock>;
  look: ClusterLook;
}

const blockAt = (pass: ClusterPass, bx: number, by: number): FlameBlock | undefined =>
  bx < 0 || by < 0 ? undefined : pass.blocks.get(by * pass.look.stride + bx);

/** How far a block has caught, 0 → 1: a neighbour counts in as it flares up, so nothing pops. */
const caught = (block: FlameBlock | undefined): number =>
  block ? Math.min(1, Math.max(0, block.age / FLAME_LOOK.terrain.catchSeconds)) : 0;

const isTop = (pass: ClusterPass, block: FlameBlock | undefined): block is FlameBlock =>
  block !== undefined && !blockAt(pass, block.bx, block.by - 1);

/** The top-edge block one column over: on the same row, or one row up or down. */
function topBeside(pass: ClusterPass, block: FlameBlock, dir: 1 | -1): FlameBlock | undefined {
  for (const dy of [0, -1, 1]) {
    const beside = blockAt(pass, block.bx + dir, block.by + dy);
    if (isTop(pass, beside)) return beside;
  }
  return undefined;
}

/** Burning blocks around a block (0 … 8), each counted as far as it has caught. */
function burningAround(pass: ClusterPass, block: FlameBlock): number {
  let around = 0;
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx !== 0 || dy !== 0) around += caught(blockAt(pass, block.bx + dx, block.by + dy));
    }
  }
  return around;
}

/** Top-edge blocks from a block to the cluster's end on one side, itself included, up to `reach`. */
function edgeDistance(pass: ClusterPass, block: FlameBlock, dir: 1 | -1): number {
  const { centreReach } = FLAME_LOOK.cluster;
  let distance = caught(block);
  let at: FlameBlock | undefined = block;
  for (let step = 1; step < centreReach && at; step += 1) {
    at = topBeside(pass, at, dir);
    distance += caught(at);
  }
  return Math.min(centreReach, distance);
}

/** A block's own flame before its neighbours change it: size by age, a fixed jitter by `key`. */
function loneFlame(block: FlameBlock, look: ClusterLook): Tongue {
  const { size, timeSeconds: t } = look;
  const { key } = block;
  const { flameWidth, heightJitter, widthJitter } = FLAME_LOOK.cluster;
  const e =
    flameEnvelope(block.age, look.burnSeconds) * (block.open ? FLAME_LOOK.terrain.openScale : 1);
  const height = heightJitter[0] + heightJitter[1] * noise(key);
  const width = widthJitter[0] + widthJitter[1] * noise(key + 7);
  return {
    x: block.x,
    y: block.y,
    width: flameWidth * size * (0.55 + 0.45 * Math.min(1, e)) * width,
    height: height * size * e * (0.82 + 0.18 * Math.sin(t * 10 + key)),
    sway: Math.sin(t * 6 + key * 1.3) * 0.2 * size * e,
  };
}

/**
 * The flame on one top-edge block (owner fire-clusters D1, "Big flames"): flames on even
 * columns take in the ones beside them and grow wider and taller for it; a flame on an odd
 * column shrinks away as a neighbour catches. Every flame is taller with more fire around it
 * and toward the middle of its cluster. Null when a neighbour has taken it in.
 */
function clusterFlame(pass: ClusterPass, block: FlameBlock): Tongue | null {
  const look = FLAME_LOOK.cluster;
  const flame = loneFlame(block, pass.look);
  const left = caught(topBeside(pass, block, -1));
  const right = caught(topBeside(pass, block, 1));
  const depth = Math.min(edgeDistance(pass, block, -1), edgeDistance(pass, block, 1));
  const around = Math.min(look.crowdCap, burningAround(pass, block));
  const tall = (1 + look.crowdGain * around) * (look.centreBase + look.centreGain * depth);
  const pooled = block.bx % 2 === 0;
  const own = pooled ? 1 : 1 - Math.max(left, right);
  if (own < 0.05) return null;
  const pool = pooled ? left + right : 0;
  const wide = own * (1 + look.poolWidth * pool);
  return {
    ...flame,
    width: flame.width * wide,
    height: flame.height * own * (1 + look.poolHeight * pool) * tall,
    sway: flame.sway * own,
  };
}

/** One slab per run of touching blocks on a row that pass `keep`, grown by `grow` all round. */
function rowSlabs(pass: ClusterPass, keep: (block: FlameBlock) => boolean, grow: number): Slab[] {
  const kept = [...pass.blocks.values()].filter(keep);
  return rowRunSlabs(kept, { size: pass.look.size, grow });
}

/**
 * A fire's burning blocks as one shape (owner fire-clusters D1–D2): a body slab per row run of
 * blocks, each overlapping the row above and below, the hot inside where a fresh block has fire
 * on both sides and below, and flames on the top edge only. Drawn in ink first and in colour on
 * top, the whole fire has one outline; blocks inside it cost no shape of their own.
 */
export function clusterFlames(
  blocks: ReadonlyMap<number, FlameBlock>,
  look: ClusterLook
): FireCluster {
  const pass: ClusterPass = { blocks, look };
  const { bodyGrow, hotUntil } = FLAME_LOOK.cluster;
  const flames: FireCluster["flames"] = [];
  for (const block of blocks.values()) {
    if (!isTop(pass, block)) continue;
    const flame = clusterFlame(pass, block);
    if (flame) flames.push({ ...flame, age: block.age });
  }
  const isHot = (block: FlameBlock): boolean =>
    block.age < hotUntil * look.burnSeconds &&
    blockAt(pass, block.bx - 1, block.by) !== undefined &&
    blockAt(pass, block.bx + 1, block.by) !== undefined &&
    blockAt(pass, block.bx, block.by + 1) !== undefined;
  return {
    body: rowSlabs(pass, () => true, bodyGrow * look.size),
    hot: rowSlabs(pass, isHot, 0),
    flames,
  };
}

const cubic = (p: readonly [number, number, number, number], u: number): number => {
  const v = 1 - u;
  return v * v * v * p[0] + 3 * v * v * u * p[1] + 3 * v * u * u * p[2] + u * u * u * p[3];
};

type Cubic = readonly [number, number, number, number];

/** Points of a cubic curve (x and y control values) at each `u`, as a flat x, y list. */
const curve = (xs: Cubic, ys: Cubic, us: readonly number[]): number[] =>
  us.flatMap((u) => [cubic(xs, u), cubic(ys, u)]);

/**
 * A tongue as a closed polygon (flat x, y list): up the left side to the tip, down the right,
 * round underneath. `grow` widens it all round for the ink pass under the fill.
 */
export function tonguePoints(tongue: Tongue, grow = 0): number[] {
  const { x, y } = tongue;
  const w = tongue.width + grow;
  const h = tongue.height + grow * 1.5;
  const tipX = x + tongue.sway;
  const top = y - h;
  const shoulder = y - h * 0.72;
  const waist = y - h * 0.5;
  return [
    ...curve([x - w, x - w, tipX - w * 0.12, tipX], [y, waist, shoulder, top], [0, 1 / 3, 2 / 3]),
    tipX,
    top,
    ...curve([tipX, tipX + w * 0.12, x + w, x + w], [top, shoulder, waist, y], [1 / 3, 2 / 3, 1]),
    ...[Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].flatMap((a) => [
      x + Math.cos(a) * w,
      y + Math.sin(a) * w,
    ]),
  ];
}

/** The spray's frame: where it starts, where it points, how wide the cone is, how far it got. */
interface SprayFrame {
  origin: Vec2;
  ca: number;
  sa: number;
  tanHalf: number;
  start: number;
  length: number;
  headRadius: number;
  /** Which side of the aim is up on screen (+1 / −1 along the normal). */
  up: 1 | -1;
  t: number;
}

function sprayFrame(
  spray: Pick<TorchSpray, "origin" | "ends">,
  opts: { timeSeconds: number; grow: number }
): SprayFrame {
  const { origin, ends } = spray;
  const angles = ends.map((end) => Math.atan2(end.y - origin.y, end.x - origin.x));
  const dists = ends.map((end) => Math.hypot(end.x - origin.x, end.y - origin.y));
  const mid = angles[Math.floor(angles.length / 2)] ?? 0;
  const first = angles[0] ?? mid;
  const last = angles[angles.length - 1] ?? mid;
  const spread = Math.abs(Math.atan2(Math.sin(last - first), Math.cos(last - first)));
  const tanHalf = Math.tan(angles.length > 1 ? spread / 2 : 0.3);
  // The outermost rays only shape the cone: the stream follows the rays between them.
  const inner = dists.length >= 5 ? dists.slice(1, -1) : dists;
  const mean = inner.reduce((sum, d) => sum + d, 0) / Math.max(1, inner.length);
  const length = mean * Math.min(1, Math.max(0, opts.grow));
  const ca = Math.cos(mid);
  return {
    origin,
    ca,
    sa: Math.sin(mid),
    tanHalf,
    start: Math.min(FLAME_LOOK.spray.nozzleReach, length * 0.5),
    length,
    headRadius: FLAME_LOOK.spray.headRadius * length * tanHalf,
    up: ca < 0 ? 1 : -1,
    t: opts.timeSeconds,
  };
}

/** Distance along the aim at shape position `ss` (0 nozzle … 1 end). */
const along = (f: SprayFrame, ss: number): number => f.start + ss * (f.length - f.start);

/** Half-width at shape position `ss`; `cap` is the layer's own 0..1, rounding its end. */
function halfWidth(f: SprayFrame, at: { ss: number; cap: number; side: 1 | -1 }): number {
  const { neckWidth, bulge } = FLAME_LOOK.spray;
  const { ss, cap } = at;
  const isUp = at.side === f.up;
  let w = 1 + neckWidth * f.tanHalf * along(f, ss);
  w += f.headRadius * smooth((ss - bulge[0]) / (bulge[1] - bulge[0]));
  // Fuller on top than underneath, with a ripple running outward.
  w *= isUp ? 1.22 : 0.82;
  w *= 1 + 0.09 * Math.sin(ss * 11 - f.t * 12 + (isUp ? 0 : 2));
  if (cap > 0.84) w *= Math.sqrt(Math.max(0, 1 - ((cap - 0.84) / 0.16) ** 2));
  return w;
}

/** A point on the edge of a layer: `s` along the layer, on `side` of the aim. */
function edgePoint(
  f: SprayFrame,
  at: { s: number; side: 1 | -1 },
  layer: { width: number; length: number }
): Vec2 {
  const ss = at.s * layer.length;
  const d = along(f, ss);
  const w = halfWidth(f, { ss, cap: at.s, side: at.side }) * layer.width;
  const lift = FLAME_LOOK.spray.lift * ss * ss * f.length;
  return {
    x: f.origin.x + f.ca * d - f.sa * w * at.side,
    y: f.origin.y + f.sa * d + f.ca * w * at.side - lift,
  };
}

function neckPolygon(f: SprayFrame, layer: { width: number; length: number }): number[] {
  const points = [f.origin.x + f.ca * f.start, f.origin.y + f.sa * f.start];
  for (let k = 1; k <= NECK_STEPS; k += 1) {
    const p = edgePoint(f, { s: k / NECK_STEPS, side: -1 }, layer);
    points.push(p.x, p.y);
  }
  for (let k = NECK_STEPS - 1; k >= 1; k -= 1) {
    const p = edgePoint(f, { s: k / NECK_STEPS, side: 1 }, layer);
    points.push(p.x, p.y);
  }
  return points;
}

function headPoint(f: SprayFrame): Vec2 {
  const { headAt, lift } = FLAME_LOOK.spray;
  // Pulled back near a wall, so the lobes stay inside what the rays reached.
  const d = Math.min(along(f, headAt), f.length - f.headRadius);
  return {
    x: f.origin.x + f.ca * d,
    y: f.origin.y + f.sa * d - lift * headAt * headAt * f.length,
  };
}

/** The head's lobes, rolling over each other away from the nozzle along the top. */
function headLobes(f: SprayFrame, head: Vec2, scale: number): Circle[] {
  if (scale <= 0) return [];
  const { lobes } = FLAME_LOOK.spray;
  const roll = f.t * 1.4 * (f.ca < 0 ? -1 : 1);
  return Array.from({ length: lobes }, (_, i) => {
    const a = (i * TAU) / lobes + roll;
    return {
      x: head.x + Math.cos(a) * f.headRadius * 0.55 * scale,
      y: head.y + Math.sin(a) * f.headRadius * 0.55 * scale,
      r: f.headRadius * (0.52 + 0.12 * Math.sin(f.t * 6 + i * 2)) * scale,
    };
  });
}

/** Flames peeling off the top edge: each rises and drifts along the aim as it shrinks. */
function shedFlames(f: SprayFrame): SprayFlame["shed"] {
  const { shed } = FLAME_LOOK.spray;
  // Smaller when a wall cuts the spray short.
  const k = Math.min(1, f.length / 60);
  return Array.from({ length: shed }, (_, i) => {
    const phase = f.t * 1.1 + i / shed;
    const fade = phase % 1;
    const seed = Math.floor(phase) * 7 + i;
    const from = edgePoint(f, { s: 0.5 + 0.48 * noise(seed + 0.5), side: f.up }, LAYERS[0]);
    return {
      x: from.x + (f.ca * fade * 8 + Math.sin(fade * 6 + i) * 1.5) * k,
      y: from.y - (fade * 20 + 1) * k,
      width: (3.4 * (1 - fade) + 0.4) * k,
      height: (7 + 3 * noise(seed)) * (1 - fade * 0.6) * k,
      sway: Math.sin(f.t * 8 + i) * 1.2 * k,
      fade,
    };
  });
}

/**
 * The drawn flame of one torch spray. `grow` runs 0 → 1 as the spray starts; `reach` is the
 * torch's full length, so a ray that ended short of it met terrain and gets a flare.
 */
export function sprayFlame(
  spray: Pick<TorchSpray, "origin" | "ends">,
  opts: { timeSeconds: number; grow: number; reach: number }
): SprayFlame {
  const f = sprayFrame(spray, opts);
  const head = headPoint(f);
  const layer = (i: 0 | 1 | 2): SprayLayer => ({
    neck: neckPolygon(f, LAYERS[i]),
    lobes: headLobes(f, head, LAYERS[i].lobes),
  });
  const grow = Math.min(1, Math.max(0, opts.grow));
  const splashes: Circle[] = [];
  spray.ends.forEach((end, i) => {
    const dx = end.x - spray.origin.x;
    const dy = end.y - spray.origin.y;
    if (Math.hypot(dx, dy) >= opts.reach - 1) return;
    splashes.push({
      x: spray.origin.x + dx * grow,
      y: spray.origin.y + dy * grow,
      r: 3.6 + Math.sin(f.t * 20 + i * 3),
    });
  });
  return {
    layers: [layer(0), layer(1), layer(2)],
    shed: shedFlames(f),
    splashes,
    head,
    headRadius: f.headRadius,
  };
}

/** The head letting go when the spray stops: three lobes rising and shrinking over `k` 0 → 1. */
export function releasePuff(last: { head: Vec2; radius: number }, k: number): Circle[] {
  const r = last.radius * 0.75 * (1 - Math.min(1, Math.max(0, k)));
  const x = last.head.x;
  const y = last.head.y - k * 16;
  return [
    { x, y, r },
    { x: x - r * 0.6, y: y + r * 0.3, r: r * 0.7 },
    { x: x + r * 0.6, y: y + r * 0.2, r: r * 0.65 },
  ];
}

/** The idle flame on a held torch's nozzle. */
export function pilotTongue(at: Vec2, flicker: { timeSeconds: number; seed: number }): Tongue {
  const { timeSeconds: t, seed } = flicker;
  return {
    x: at.x,
    y: at.y,
    width: 2.4,
    height: 6.8 * (0.85 + 0.15 * Math.sin(t * 17 + seed)),
    sway: Math.sin(t * 7 + seed) * 0.9,
  };
}
