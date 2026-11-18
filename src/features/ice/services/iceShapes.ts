import type { Vec2 } from "@/shared/types/gameGeometry.types";
import { rowRunSlabs, type BlockSlab, type GridBlock } from "@/shared/utils/blockSlabs";
import type { FreezeRayBeam } from "@/features/ice/types/ice.types";

/**
 * Ice geometry: pure shapes the ice renderer fills. Frozen ground is drawn the way a fire's body
 * is (owner, ice-element D4: "the same shape as a burning shape could also be a frozen shape"):
 * the frozen samples in 2 × 2 blocks, one slab per row run of blocks, so a frozen patch of any
 * size costs a slab per row run. On top of that: a lighter lip where the block above is not
 * frozen ground, and a few gloss streaks at fixed places, the slippery cue of DESIGN_LANGUAGE § 2.
 */
export const ICE_LOOK = {
  /** Corner radius of a body slab, in blocks. */
  bodyRadius: 0.2,
  /** How far a body slab overlaps its neighbours, in blocks (hides the seams between rows). */
  bodyGrow: 0.04,
  /** Height of the lip on a top edge, in blocks. */
  lipHeight: 0.4,
  /** One block in this many carries a gloss streak. */
  glossEvery: 9,
  beam: {
    /** Where the beam leaves the emitter: units along the aim from the helmet point. */
    emitterReach: 15,
    /** Half-width of the beam at the emitter, world units. */
    startHalfWidth: 1.6,
    /** The white core's width as a share of the beam's. */
    coreShare: 0.4,
    /** Radius of the frost burst where a ray touches terrain, and how much it pulses. */
    burstRadius: 4,
    burstPulse: 1.2,
    /** Pulses per second (inside the juice `flash` window per pulse). */
    pulseHz: 9,
  },
} as const;

export interface FrozenShapes {
  body: BlockSlab[];
  lip: BlockSlab[];
  /** Gloss streaks: a short 45° line each, from `a` to `b`. */
  gloss: { a: Vec2; b: Vec2 }[];
}

/** The frozen blocks (by `by * stride + bx`) as body slabs, top-edge lips and gloss streaks. */
export function frozenShapes(
  blocks: ReadonlyMap<number, GridBlock>,
  look: { size: number; stride: number }
): FrozenShapes {
  const { size, stride } = look;
  const all = [...blocks.values()];
  const has = (bx: number, by: number): boolean =>
    bx >= 0 && by >= 0 && blocks.has(by * stride + bx);
  const tops = all.filter((block) => !has(block.bx, block.by - 1));
  const lip = rowRunSlabs(tops, { size, grow: 0 }).map((slab) => ({
    ...slab,
    h: ICE_LOOK.lipHeight * size,
  }));
  // Only blocks inside the patch carry gloss, so a streak never pokes out of the frozen shape.
  const glossy = all.filter(
    (block) =>
      (block.bx * 7 + block.by * 13) % ICE_LOOK.glossEvery === 0 &&
      has(block.bx - 1, block.by) &&
      has(block.bx + 1, block.by) &&
      has(block.bx, block.by - 1) &&
      has(block.bx, block.by + 1)
  );
  const gloss = glossy.map((block) => ({
    a: { x: (block.bx + 0.85) * size, y: (block.by + 0.1) * size },
    b: { x: (block.bx + 0.15) * size, y: (block.by + 0.9) * size },
  }));
  return { body: rowRunSlabs(all, { size, grow: ICE_LOOK.bodyGrow * size }), lip, gloss };
}

export interface BeamShape {
  /** The beam's outline: from the emitter out along one side and back along the other. */
  outline: number[];
  /** The white core: a thinner beam inside the outline. */
  core: number[];
  /** A frost burst at each ray end that touched terrain. */
  bursts: { x: number; y: number; r: number }[];
}

/** One freeze ray as a tapering beam fitted to the rays the sim cast (never wider than they hit). */
export function beamShape(beam: FreezeRayBeam, timeSeconds: number): BeamShape {
  const look = ICE_LOOK.beam;
  const first = beam.ends[0] ?? beam.origin;
  const last = beam.ends[beam.ends.length - 1] ?? beam.origin;
  const mid = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2 };
  const length = Math.hypot(mid.x - beam.origin.x, mid.y - beam.origin.y) || 1;
  const aim = { x: (mid.x - beam.origin.x) / length, y: (mid.y - beam.origin.y) / length };
  const reach = Math.min(look.emitterReach, length * 0.5);
  const start = { x: beam.origin.x + aim.x * reach, y: beam.origin.y + aim.y * reach };
  const side = { x: -aim.y * look.startHalfWidth, y: aim.x * look.startHalfWidth };
  const fan = (share: number): number[] => {
    const toward = (end: Vec2): Vec2 => ({
      x: mid.x + (end.x - mid.x) * share,
      y: mid.y + (end.y - mid.y) * share,
    });
    const ends = beam.ends.map(toward);
    const points = [
      { x: start.x - side.x * share, y: start.y - side.y * share },
      ...ends,
      { x: start.x + side.x * share, y: start.y + side.y * share },
    ];
    return points.flatMap((p) => [p.x, p.y]);
  };
  const pulse = 0.5 + 0.5 * Math.sin(timeSeconds * Math.PI * 2 * look.pulseHz + beam.slot);
  const bursts = beam.ends
    .filter((_, i) => beam.touched[i] === true)
    .map((end) => ({ x: end.x, y: end.y, r: look.burstRadius + look.burstPulse * pulse }));
  return { outline: fan(1), core: fan(look.coreShare), bursts };
}
