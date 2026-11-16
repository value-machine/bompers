import type { GameTunables } from "@/shared/types/gameTunables.types";
import { contactShadow } from "@/shared/utils/contactShadow";
import {
  createDampedSpring,
  stepDampedSpring,
  type DampedSpring,
} from "@/shared/utils/dampedSpring";
import type { PlayerState } from "@/features/player/types/player.types";

/**
 * Render-only blob pose (DESIGN_LANGUAGE § 4, § 6): squash / stretch, foot deform and motion,
 * contact shadow and the helmet spring, derived from sim state and its event counters plus a wall clock. Pure TS so the
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
  /** Crouch pose progress 0 (standing) … 1 (sunk), and the render clock it was stepped at. */
  crouchBlend: number;
  crouchAtMs: number | null;
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
  /** Helmet / eye offsets of the crouch (all zero when standing). */
  face: CrouchFace;
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
  crouchBlend: player.crouching ? 1 : 0,
  crouchAtMs: null,
});

export type CrouchTunables = GameTunables["player"]["crouch"];

/**
 * Moves the crouch blend toward the sim's `crouching` over `easeSeconds` of render time
 * (frame-rate independent). Call once per frame before `blobPose`.
 */
export function stepCrouchBlend(
  anim: BlobAnim,
  frame: { player: PlayerState; crouch: CrouchTunables; nowMs: number }
): void {
  const { player, crouch, nowMs } = frame;
  const elapsed = anim.crouchAtMs === null ? 0 : Math.max(0, nowMs - anim.crouchAtMs) / 1000;
  anim.crouchAtMs = nowMs;
  const target = player.crouching ? 1 : 0;
  const step = crouch.easeSeconds > 0 ? elapsed / crouch.easeSeconds : 1;
  anim.crouchBlend =
    target > anim.crouchBlend
      ? Math.min(target, anim.crouchBlend + step)
      : Math.max(target, anim.crouchBlend - step);
}

/** Crouch pose factors at the anim's blend: body (sx, sy); 1 when standing. The feet stay as they are. */
function crouchScale(anim: BlobAnim, crouch: CrouchTunables | undefined) {
  const k = crouch ? smoothstep(anim.crouchBlend) : 0;
  const lerp = (to: number): number => 1 + (to - 1) * k;
  return crouch ? { sx: lerp(crouch.bodySx), sy: lerp(crouch.bodySy) } : { sx: 1, sy: 1 };
}

/** The face while crouching: how far the helmet sinks and the eyes rise (mockup units). */
export interface CrouchFace {
  helmetDrop: number;
  eyeLift: number;
  /** Eyes drawn under the helmet dome, so its rim covers them (only while crouching). */
  eyesUnderHelmet: boolean;
}

/** Crouch face at the anim's blend; zero offsets and eyes over the dome when standing. */
export function crouchFace(anim: BlobAnim, crouch: CrouchTunables | undefined): CrouchFace {
  const k = crouch ? smoothstep(anim.crouchBlend) : 0;
  return {
    helmetDrop: (crouch?.helmetDrop ?? 0) * k,
    eyeLift: (crouch?.eyeLift ?? 0) * k,
    eyesUnderHelmet: k > 0,
  };
}

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

/**
 * The pose to draw this frame. Call `noteBlobEvents` (and `stepCrouchBlend` when `crouch` is
 * given) first. The crouch sinks the body (head included); the feet keep their pose.
 */
export function blobPose(
  anim: BlobAnim,
  frame: { player: PlayerState; squash: SquashTunables; nowMs: number; crouch?: CrouchTunables }
): BlobPose {
  const { player, squash, nowMs } = frame;
  const body = eventSquash(anim, { squash, atMs: nowMs });
  const feet = eventSquash(anim, { squash, atMs: nowMs - FEET_LAG_MS });
  const stretch = motionStretch(player, frame);
  const crouched = crouchScale(anim, frame.crouch);
  return {
    bodySx: (body.sx / stretch) * crouched.sx,
    bodySy: body.sy * stretch * crouched.sy,
    feetSx: 1 + (feet.sx - 1) * FEET_SQUASH_GAIN,
    feetSy: Math.max(0.3, 1 + (feet.sy - 1) * FEET_SQUASH_GAIN),
    shadow: blobShadow(player),
    face: crouchFace(anim, frame.crouch),
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

/**
 * Render-only foot motion (DESIGN_LANGUAGE § 6). Each foot gets an offset and a rotation from
 * sim state: a stepping arc with toe tilt while running, a velocity tilt in the air that lags on
 * a damped spring, a splay kicked by landings and jumps, and, while wall-sliding or just after a
 * wall-jump, both feet turned with their soles to the wall. Pure TS so the curves are
 * unit-tested; the renderer only applies the numbers. Never feeds back into the sim.
 */
export type FeetTunables = GameTunables["feel"]["feet"];

/** One foot, relative to the feet point: centre offset (world units, y down) and rotation (rad, clockwise). */
export interface FootPose {
  x: number;
  y: number;
  rotation: number;
}

/** Per-player foot memory kept by the render layer. */
export interface FeetMotion {
  /** Lag of the air tilt behind its target (rad). */
  tilt: DampedSpring;
  /** Outward spread (rad; positive = feet spread, outer ends up). */
  splay: DampedSpring;
  /** Tilt target of the last step, so a target jump becomes spring offset. */
  lastTiltTarget: number;
  /** 0 = normal pose, 1 = fully turned to the wall. */
  wall: number;
  wallSide: -1 | 1;
  /** Render clock until which a wall-jump keeps the feet on the wall it left. */
  wallJumpHoldUntilMs: number;
  seenLandings: number;
  seenJumps: number;
  seenWallJumps: number;
  lastMs: number | null;
  /** Left and right foot after the last step. */
  feet: [FootPose, FootPose];
}

/** Feet sit 0.45 R left and right of the centre (DESIGN_LANGUAGE § 2). */
const FOOT_SPACING = 0.45;
/** Feet slide out this many R per radian of splay. */
const SPLAY_SPREAD = 0.3;

const restFoot = (): FootPose => ({ x: 0, y: 0, rotation: 0 });

export const createFeetMotion = (player: PlayerState): FeetMotion => ({
  tilt: createDampedSpring(),
  splay: createDampedSpring(),
  lastTiltTarget: 0,
  wall: 0,
  wallSide: player.lastWallDir,
  wallJumpHoldUntilMs: -Infinity,
  seenLandings: player.landCount,
  seenJumps: player.jumpCount,
  seenWallJumps: player.wallJumpCount,
  lastMs: null,
  feet: [restFoot(), restFoot()],
});

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

interface FeetFrame {
  player: PlayerState;
  feet: FeetTunables;
  /** Body radius R, world units. */
  r: number;
  /** Body horizontal scale this frame (the feet ride the body's width). */
  bodySx: number;
  nowMs: number;
}

/** Splay kicks for sim events since the last step, and the wall-jump hold. */
function noteFeetEvents(motion: FeetMotion, frame: FeetFrame): void {
  const { player, feet, nowMs } = frame;
  if (player.landCount !== motion.seenLandings && player.lastLandingSpeed >= MIN_LANDING_SPEED) {
    motion.splay.velocity += feet.landKick;
  }
  if (player.jumpCount !== motion.seenJumps) motion.splay.velocity -= feet.jumpKick;
  if (player.wallJumpCount !== motion.seenWallJumps) {
    motion.splay.velocity -= feet.jumpKick;
    motion.wallJumpHoldUntilMs = nowMs + feet.wallJumpHoldSeconds * 1000;
  }
  motion.seenLandings = player.landCount;
  motion.seenJumps = player.jumpCount;
  motion.seenWallJumps = player.wallJumpCount;
}

/** Air tilt target: feet trail the horizontal speed and droop (rising) or flare (falling). */
function airTiltTarget(player: PlayerState, feet: FeetTunables): number {
  if (player.grounded) return 0;
  return -clamp(player.vx / feet.airTiltSpeed, -1, 1) * feet.airTilt;
}

/** Which wall the feet turn to this step, or null. A wall-jump keeps the wall it left. */
function wallTarget(motion: FeetMotion, frame: FeetFrame): -1 | 1 | null {
  const { player, nowMs } = frame;
  if (player.tumbleSeconds > 0) return null;
  if (!player.grounded && player.wallDir !== 0) return player.wallDir;
  if (nowMs < motion.wallJumpHoldUntilMs) return player.lastWallDir;
  return null;
}

function stepSprings(motion: FeetMotion, frame: FeetFrame, dt: number): void {
  const { feet } = frame;
  const target = airTiltTarget(frame.player, feet);
  // A jump in the target leaves the drawn tilt behind; the spring pulls it after (lag + overshoot).
  motion.tilt.value -= target - motion.lastTiltTarget;
  motion.lastTiltTarget = target;
  stepDampedSpring(motion.tilt, feet, dt);
  stepDampedSpring(motion.splay, feet, dt);
  motion.splay.value = clampAbs(motion.splay.value, feet.maxSplay);
  motion.tilt.value = clampAbs(motion.tilt.value, feet.maxSplay);
}

function stepWallBlend(motion: FeetMotion, frame: FeetFrame, dt: number): void {
  const side = wallTarget(motion, frame);
  if (side !== null) motion.wallSide = side;
  const rate = dt / Math.max(frame.feet.wallBlendSeconds, 1e-3);
  motion.wall = clamp(motion.wall + (side === null ? -rate : rate), 0, 1);
}

/** Stepping arc of foot `i` while running: lift, forward swing and toe tilt. */
function stepCycle(frame: FeetFrame, i: number): FootPose {
  const { player, feet, r } = frame;
  const speed = Math.abs(player.vx);
  if (!player.grounded || speed < 20) return restFoot();
  const k = Math.min(1, speed / feet.fullStepSpeed);
  const dir = Math.sign(player.vx);
  // The feet are half a cycle apart; a foot moves forward while it is lifted.
  const phase = player.x / (feet.stride * r) + i * Math.PI;
  const up = Math.max(0, Math.sin(phase));
  return {
    // The phase runs with x, so the swing already points along the run.
    x: -Math.cos(phase) * feet.stepSwing * r * k,
    y: -up * feet.stepLift * r * k,
    // The lifted foot tips its toe up, toward the run.
    rotation: -dir * up * feet.stepTilt * k,
  };
}

/** Normal (ground / air) pose of foot `i` (0 = left). */
function normalFoot(motion: FeetMotion, frame: FeetFrame, i: number): FootPose {
  const side = i === 0 ? -1 : 1;
  const { r, bodySx, player, feet } = frame;
  const step = stepCycle(frame, i);
  const splay = motion.splay.value;
  // Rising feet droop at their outer ends, falling feet flare up.
  const droop = player.grounded ? 0 : clamp(-player.vy / feet.airTiltSpeed, -1, 1) * feet.airTilt;
  const tilt = motion.lastTiltTarget + motion.tilt.value;
  return {
    x: side * (FOOT_SPACING + SPLAY_SPREAD * splay) * r * bodySx + step.x,
    y: step.y,
    rotation: step.rotation + tilt + side * (droop - splay),
  };
}

/** Wall pose of foot `i`: soles to the wall, the far foot low and the near foot high. */
function wallFoot(motion: FeetMotion, frame: FeetFrame, i: number): FootPose {
  const side = i === 0 ? -1 : 1;
  const wallSide = motion.wallSide;
  const near = side === wallSide;
  const { r, feet } = frame;
  return {
    x: wallSide * feet.wallX * r,
    y: -(near ? feet.wallHigh : feet.wallLow) * r,
    // Local +y (the sole) points at the wall.
    rotation: -wallSide * (Math.PI / 2),
  };
}

/** Advances the foot motion to `nowMs` and writes both feet into `motion.feet`. */
export function stepFeetMotion(motion: FeetMotion, frame: FeetFrame): [FootPose, FootPose] {
  // A clock that stalls or jumps back (tab switch, reset) steps nothing.
  const dt = motion.lastMs === null ? 0 : Math.max(0, (frame.nowMs - motion.lastMs) / 1000);
  motion.lastMs = frame.nowMs;
  noteFeetEvents(motion, frame);
  stepSprings(motion, frame, dt);
  stepWallBlend(motion, frame, dt);
  const w = smoothstep(motion.wall);
  motion.feet.forEach((foot, i) => {
    const normal = normalFoot(motion, frame, i);
    const wall = wallFoot(motion, frame, i);
    foot.x = lerp(normal.x, wall.x, w);
    foot.y = lerp(normal.y, wall.y, w);
    foot.rotation = lerp(normal.rotation, wall.rotation, w);
  });
  return motion.feet;
}
