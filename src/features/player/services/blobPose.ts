import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Render-only blob pose (DESIGN_LANGUAGE § 4, § 6): squash / stretch, foot deform and contact
 * shadow, derived from sim state and its event counters plus a wall clock. Pure TS so the
 * curves are unit-tested; the renderer only applies the numbers. Never feeds back into the sim.
 */
export type SquashTunables = GameTunables["player"]["squash"];

type SquashKind = "land" | "jump" | "wallJump";

/** Per-player animation memory kept by the render layer. */
export interface BlobAnim {
  seenJumps: number;
  seenWallJumps: number;
  seenLandings: number;
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
/** Shadow fade distance and size (DESIGN_LANGUAGE § 4). */
const SHADOW_RANGE = 240;
const SHADOW_HEIGHT = 12;
const SHADOW_ALPHA = 0.28;
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
  active: null,
});

/** Back-out ease 0 → 1 with a small overshoot past 1. */
const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
};

const easeOutQuad = (t: number): number => 1 - (1 - t) * (1 - t);

/** Starts a squash for the newest sim event since the last frame (the latest one wins). */
export function noteBlobEvents(
  anim: BlobAnim,
  frame: { player: PlayerState; squash: SquashTunables; nowMs: number }
): void {
  const { player, squash, nowMs } = frame;
  if (player.landCount !== anim.seenLandings && player.lastLandingSpeed >= MIN_LANDING_SPEED) {
    const impact = Math.min(1, player.lastLandingSpeed / squash.landFullImpact);
    anim.active = { kind: "land", startMs: nowMs, amount: 0.5 + 0.5 * impact };
  }
  if (player.jumpCount !== anim.seenJumps) {
    anim.active = { kind: "jump", startMs: nowMs, amount: 1 };
  }
  if (player.wallJumpCount !== anim.seenWallJumps) {
    anim.active = { kind: "wallJump", startMs: nowMs, amount: 1 };
  }
  anim.seenLandings = player.landCount;
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
  const t = Math.min(1, (player.groundBelowY - player.y) / SHADOW_RANGE);
  if (t >= 1) return null;
  return {
    y: player.groundBelowY,
    width: 1.05 * player.width * (1 - 0.5 * t),
    height: SHADOW_HEIGHT * (1 - 0.5 * t),
    alpha: SHADOW_ALPHA * (1 - t),
  };
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
