import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { PosedField } from "@/shared/types/sampleFront.types";
import type {
  SprayBurst,
  SprayParticleLook,
  SprayParticleStream,
  SprayPuff,
  SprayStepHits,
} from "@/shared/types/sprayParticles.types";
import { bodyAt, solidAt, type RayFanBody } from "@/shared/utils/rayFan";

/**
 * A spray particle stream (owner, freeze-ray-particles D1, "Cold travels"): a held spray weapon
 * emits puffs from its nozzle across its fan at the aim of that moment, and each puff keeps the
 * heading and speed it left with. Turning the aim never moves a puff already in flight, so a
 * spinning holder leaves a spiral. A puff marches half a sample at a time, as a ray of the shared
 * ray fan does (`rayFan.ts`): it stops and bursts at the first solid sample of any field (the
 * static terrain and every moving part), passes through the bodies it meets and reports them, and
 * dies when it has travelled its reach. What the spray does happens where its puffs are, so what
 * is seen is what is hit. Pure and deterministic: the spread across the fan is a golden-ratio
 * sequence, no RNG.
 */
export const createSprayStream = (): SprayParticleStream => ({
  puffs: [],
  bursts: [],
  emitted: 0,
  carry: 0,
});

const GOLDEN = 0.6180339887498949;

/**
 * Emits this step's puffs from `origin` across the fan at `aim`. Each new puff waits a share of
 * the step at the nozzle, so a step's puffs leave spaced along the aim, not in a clump.
 */
export function emitSpray(
  stream: SprayParticleStream,
  emit: { origin: Vec2; aim: Vec2; dt: number; look: SprayParticleLook }
): void {
  const { look, dt } = emit;
  const owed = stream.carry + look.rate * dt;
  const count = Math.floor(owed);
  stream.carry = owed - count;
  const base = Math.atan2(emit.aim.y, emit.aim.x);
  const half = (look.halfAngleDegrees * Math.PI) / 180;
  for (let k = 0; k < count; k += 1) {
    const u = (stream.emitted * GOLDEN) % 1;
    stream.emitted += 1;
    const a = base - half + 2 * half * u;
    const wait = (look.speed * dt * (k + 1)) / (count + 1);
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    stream.puffs.push({ x: emit.origin.x, y: emit.origin.y, dx, dy, travelled: -wait });
  }
  if (stream.puffs.length > look.cap) stream.puffs.splice(0, stream.puffs.length - look.cap);
}

interface FlightContext<Body extends RayFanBody> {
  fields: readonly PosedField[];
  bodies: readonly Body[];
  hitHeight?: (body: Body) => number;
  /** How far a puff may fly this step (shorter in a beam clash). */
  reach: number;
  now: number;
  hits: SprayStepHits<Body>;
  bursts: SprayBurst[];
}

/** Moves a puff one march step and lets it meet what is there; false when it stopped. */
function marchStep<Body extends RayFanBody>(
  puff: SprayPuff,
  move: number,
  ctx: FlightContext<Body>
): boolean {
  puff.x += puff.dx * move;
  puff.y += puff.dy * move;
  puff.travelled += move;
  if (puff.travelled > ctx.reach) return false;
  const solid = solidAt(ctx.fields, puff);
  if (solid) {
    ctx.hits.terrain.push(solid);
    ctx.bursts.push({ x: puff.x, y: puff.y, at: ctx.now });
    return false;
  }
  const body = bodyAt(ctx, puff);
  if (body) {
    const sum = ctx.hits.bodies.get(body) ?? { x: 0, y: 0 };
    ctx.hits.bodies.set(body, { x: sum.x + puff.dx, y: sum.y + puff.dy });
  }
  return true;
}

/** Flies one puff `distance` further; false when it stopped (field or reach) this step. */
function fly<Body extends RayFanBody>(
  puff: SprayPuff,
  distance: number,
  ctx: FlightContext<Body>
): boolean {
  const step = (ctx.fields[0]?.field.cellSize ?? 1) / 2;
  const target = puff.travelled + distance;
  // A puff emitted mid-step waits at the nozzle for its share of the step.
  if (puff.travelled < 0) puff.travelled = Math.min(target, 0);
  while (puff.travelled < target) {
    if (!marchStep(puff, Math.min(step, target - puff.travelled), ctx)) return false;
  }
  return true;
}

/**
 * Flies every puff one step on its own heading. Returns what they met this step; the bursts of
 * the puffs that stopped are added to the stream, and old bursts are dropped.
 */
export function advanceSpray<Body extends RayFanBody>(
  stream: SprayParticleStream,
  step: {
    fields: readonly PosedField[];
    bodies: readonly Body[];
    hitHeight?: (body: Body) => number;
    dt: number;
    now: number;
    look: SprayParticleLook;
    /** How far a puff may fly in all (the look's length when left out). */
    reach?: number;
  }
): SprayStepHits<Body> {
  const hits: SprayStepHits<Body> = { terrain: [], bodies: new Map() };
  const ctx: FlightContext<Body> = {
    fields: step.fields,
    bodies: step.bodies,
    hitHeight: step.hitHeight,
    reach: Math.min(step.reach ?? step.look.length, step.look.length),
    now: step.now,
    hits,
    bursts: stream.bursts,
  };
  const distance = step.look.speed * step.dt;
  stream.puffs = stream.puffs.filter((puff) => fly(puff, distance, ctx));
  stream.bursts = stream.bursts.filter((burst) => step.now - burst.at < step.look.burstSeconds);
  return hits;
}

/** Whether the stream has nothing left to fly or draw. */
export const sprayStreamEmpty = (stream: SprayParticleStream): boolean =>
  stream.puffs.length === 0 && stream.bursts.length === 0;
