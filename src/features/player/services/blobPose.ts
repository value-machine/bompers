import type { GameTunables } from "@/shared/types/gameTunables.types";
import { contactShadow } from "@/shared/utils/contactShadow";
import {
  createDampedSpring,
  stepDampedSpring,
  type DampedSpring,
} from "@/shared/utils/dampedSpring";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Render-only blob pose (DESIGN_LANGUAGE § 4, § 6): squash / stretch, foot deform and contact
 * shadow, derived from sim state and its event counters plus a wall clock. Pure TS so the
 * curves are unit-tested; the renderer only applies the numbers. Never feeds back into the sim.
 */
export type SquashTunables = GameTunables["player"]["squash"];
export type HelmetTunables = GameTunables["feel"]["helmet"];

type SquashKind = "land" | "jump" | "wallJump";

/** Per-player animation memory kept by the render layer. */
export interface BlobAnim {
  seenJumps: number;
  seenWallJumps: number;
  seenLandings: number;
  seenTumbleBounces: number;
  active: { kind: SquashKind; startMs: number; amount: number } | null;
}

export interface BlobShadow {
  /** World y of the surface the shadow lies on. */
  y: number;
  width: number;
  height: number;
  alpha: number;
}

export interface BlobPose {
  /** Body scale, anchored at the feet point. */
  bodySx: number;
  bodySy: number;
  /** Foot scale (feet lag the body and squash flatter). */
  feetSx: number;
  feetSy: number;
  shadow: BlobShadow | null;
}

/**
 * Extra pose an ability system (the dive) lays over the movement pose for one frame: the whole
 * blob turns by `rotation` (radians, clockwise, around the body centre; 0 = upright) and the
 * body scale is multiplied by `sx` / `sy`.
 */
export interface BlobPoseOverlay {
  rotation: number;
  sx: number;
  sy: number;
}

/** Feet lag the body by about two display frames (DESIGN_LANGUAGE § 6). */
export const FEET_LAG_MS = 33;
/** Feet squash this much harder than the body. */
const FEET_SQUASH_GAIN = 1.4;
/** Extra airborne stretch at terminal fall speed. */
const AIR_STRETCH = 0.08;
const AIR_STRETCH_SPEED = 1400;
/** Landings slower than this (spawning or stepping onto ground) play no squash. */
const MIN_LANDING_SPEED = 120;
/** Below this horizontal speed a grounded blob counts as idle (breathing). */
const IDLE_SPEED = 20;

export const createBlobAnim = (player: PlayerState): BlobAnim => ({
  seenJumps: player.jumpCount,
  seenWallJumps: player.wallJumpCount,
  seenLandings: player.landCount,
  seenTumbleBounces: player.tumbleBounceCount,
  active: null,
});

/** Back-out ease 0 → 1 with a small overshoot past 1. */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/**
 * Starts a squash for the newest sim event since the last frame (the latest one wins). Returns
 * the squash it started, or null, so the helmet spring can react to the same moment.
 */
export function noteBlobEvents(
  anim: BlobAnim,
  frame: { player: PlayerState; squash: SquashTunables; nowMs: number }
): BlobAnim["active"] {
  const before = anim.active;
  const { player, squash, nowMs } = frame;
  if (player.landCount !== anim.seenLandings && player.lastLandingSpeed >= MIN_LANDING_SPEED) {
    const impact = Math.min(1, player.lastLandingSpeed / squash.landFullImpact);
    anim.active = { kind: "land", startMs: nowMs, amount: 0.5 + 0.5 * impact };
  }
  // A tumble bounce (floor or wall) squashes like a landing at that speed.
  if (player.tumbleBounceCount !== anim.seenTumbleBounces) {
    const impact = Math.min(1, player.lastTumbleBounceSpeed / squash.landFullImpact);
    anim.active = { kind: "land", startMs: nowMs, amount: 0.5 + 0.5 * impact };
  }
  if (player.jumpCount !== anim.seenJumps) {
    anim.active = { kind: "jump", startMs: nowMs, amount: 1 };
  }
  if (player.wallJumpCount !== anim.seenWallJumps) {
    anim.active = { kind: "wallJump", startMs: nowMs, amount: 1 };
  }
  markEventsSeen(anim, player);
  return anim.active === before ? null : anim.active;
}

function markEventsSeen(anim: BlobAnim, player: PlayerState): void {
  anim.seenLandings = player.landCount;
  anim.seenTumbleBounces = player.tumbleBounceCount;
  anim.seenJumps = player.jumpCount;
  anim.seenWallJumps = player.wallJumpCount;
}

/** Event squash at `atMs` as (sx, sy); (1, 1) once it has played out. */
export function eventSquash(
  anim: BlobAnim,
  frame: { squash: SquashTunables; atMs: number }
): { sx: number; sy: number } {
  const { active } = anim;
  if (!active) return { sx: 1, sy: 1 };
  const shape = frame.squash[active.kind];
  const t = (frame.atMs - active.startMs) / (shape.seconds * 1000);
  if (t >= 1 || t < 0) return { sx: 1, sy: 1 };
  const remaining = active.kind === "land" ? 1 - easeOutBack(t) : 1 - easeOutQuad(t);
  const k = remaining * active.amount;
  return { sx: 1 + (shape.sx - 1) * k, sy: 1 + (shape.sy - 1) * k };
}

/** Velocity stretch in the air, breathing on the ground at rest; area kept (sx = 1 / sy). */
function motionStretch(player: PlayerState, frame: { squash: SquashTunables; nowMs: number }) {
  if (!player.grounded) {
    return 1 + AIR_STRETCH * Math.min(1, Math.abs(player.vy) / AIR_STRETCH_SPEED);
  }
  if (Math.abs(player.vx) > IDLE_SPEED) return 1;
  const phase = (frame.nowMs / 1000 / frame.squash.breathSeconds) * Math.PI * 2;
  return 1 + frame.squash.breathAmplitude * Math.sin(phase);
}

/** Flat contact shadow while airborne over ground within range; null otherwise. */
export function blobShadow(player: PlayerState): BlobShadow | null {
  if (player.grounded || player.groundBelowY === null) return null;
  const shadow = contactShadow(player.groundBelowY - player.y, player.width);
  if (!shadow || shadow.alpha <= 0) return null;
  return { y: player.groundBelowY, ...shadow };
}

/** The pose to draw this frame. Call `noteBlobEvents` first. */
export function blobPose(
  anim: BlobAnim,
  frame: { player: PlayerState; squash: SquashTunables; nowMs: number }
): BlobPose {
  const { player, squash, nowMs } = frame;
  const body = eventSquash(anim, { squash, atMs: nowMs });
  const feet = eventSquash(anim, { squash, atMs: nowMs - FEET_LAG_MS });
  const stretch = motionStretch(player, frame);
  return {
    bodySx: body.sx / stretch,
    bodySy: body.sy * stretch,
    feetSx: 1 + (feet.sx - 1) * FEET_SQUASH_GAIN,
    feetSy: Math.max(0.3, 1 + (feet.sy - 1) * FEET_SQUASH_GAIN),
    shadow: blobShadow(player),
  };
}

/**
 * The helmet (with its emblem) rides a damped spring that lags behind the body (DESIGN_LANGUAGE
 * § 6): `drop` sinks it toward the body (mockup units), `tilt` rocks it (radians, clockwise).
 */
export interface HelmetWobble {
  tilt: DampedSpring;
  drop: DampedSpring;
  /** Render clock of the last step (null before the first). */
  lastMs: number | null;
  /** `startMs` of the newest hit already kicked. */
  seenHitMs: number;
  /** The drawn offset after the last step, capped: tilt (radians), drop (mockup units). */
  pose: { tilt: number; drop: number };
}

export const createHelmetWobble = (): HelmetWobble => ({
  tilt: createDampedSpring(),
  drop: createDampedSpring(),
  lastMs: null,
  seenHitMs: -1,
  pose: { tilt: 0, drop: 0 },
});

/** Velocity kick for a squash moment: landings and tumble bounces sink it, jumps leave it behind. */
export function kickHelmetForSquash(
  wobble: HelmetWobble,
  moment: { kind: SquashKind; amount: number; vx: number; tumbling: boolean },
  helmet: HelmetTunables
): void {
  const side = Math.sign(moment.vx);
  if (moment.kind === "land") {
    wobble.drop.velocity += helmet.landDrop * moment.amount;
    // A tumble bounce also rocks it, against the roll.
    if (moment.tumbling) wobble.tilt.velocity -= side * helmet.hitTilt * 0.5 * moment.amount;
  }
  if (moment.kind === "jump") wobble.drop.velocity += helmet.jumpDrop;
  if (moment.kind === "wallJump") wobble.tilt.velocity += side * helmet.wallJumpTilt;
}

/** Velocity kick for a hit pushing toward `dirX`: the helmet rocks that way and sinks a little. */
export function kickHelmetForHit(
  wobble: HelmetWobble,
  hit: { dirX: number; hard: boolean },
  helmet: HelmetTunables
): void {
  const scale = hit.hard ? 1.5 : 1;
  wobble.tilt.velocity += hit.dirX * helmet.hitTilt * scale;
  wobble.drop.velocity += helmet.hitDrop * scale;
}

const clampAbs = (value: number, max: number): number => Math.max(-max, Math.min(max, value));

/** Steps both springs to `nowMs` and writes the capped offset into `wobble.pose`. */
export function stepHelmetWobble(
  wobble: HelmetWobble,
  frame: { nowMs: number; helmet: HelmetTunables }
): void {
  const { nowMs, helmet } = frame;
  const dt = wobble.lastMs === null ? 0 : (nowMs - wobble.lastMs) / 1000;
  wobble.lastMs = nowMs;
  stepDampedSpring(wobble.tilt, helmet, dt);
  stepDampedSpring(wobble.drop, helmet, dt);
  wobble.pose.tilt = clampAbs(wobble.tilt.value, helmet.maxTilt);
  wobble.pose.drop = clampAbs(wobble.drop.value, helmet.maxDrop);
}
