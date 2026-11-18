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
  seenRollBounces: number;
  /** `impact` (0 … 1) sets a landing's sink time; jumps use 1. */
  active: { kind: SquashKind; startMs: number; amount: number; impact: number } | null;
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
 * body scale is multiplied by `sx` / `sy`. A drawn hop raises the drawing by `lift` world units
 * (the body and its shadow stay where the sim has them); `pupilScale` shrinks the pupils
 * (panic pinpricks, fire-burn D1). Both are render only.
 */
export interface BlobPoseOverlay {
  rotation: number;
  sx: number;
  sy: number;
  lift?: number;
  pupilScale?: number;
}

/**
 * Pinprick pupils of a blob in panic: burning (fire-burn D1), and squeezed or crushed by a moving
 * part (owner, squish-eyes). Shared so every panic reads as the same face.
 */
export const PANIC_PUPIL_SCALE = 0.45;

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
  seenRollBounces: player.rollBounceCount,
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

export type BarrelPopTunables = GameTunables["feel"]["barrelPop"];

/**
 * Scale of the helmet barrel `elapsedMs` after a shot (weapon-visuals-embellish D5): the pop pose
 * at the shot, springing back to rest with a small overshoot. Along the barrel is x.
 */
export function barrelPopScale(
  elapsedMs: number,
  pop: BarrelPopTunables
): { sx: number; sy: number } {
  const t = elapsedMs / (pop.seconds * 1000);
  if (t < 0 || t >= 1) return { sx: 1, sy: 1 };
  const k = 1 - easeOutBack(t);
  return { sx: 1 + (pop.sx - 1) * k, sy: 1 + (pop.sy - 1) * k };
}

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
    anim.active = landSquash(player.lastLandingSpeed, { squash, nowMs });
  }
  // A roll bounce (floor or wall) squashes like a landing at that speed.
  if (player.rollBounceCount !== anim.seenRollBounces) {
    anim.active = landSquash(player.lastRollBounceSpeed, { squash, nowMs });
  }
  if (player.jumpCount !== anim.seenJumps) {
    anim.active = { kind: "jump", startMs: nowMs, amount: 1, impact: 1 };
  }
  if (player.wallJumpCount !== anim.seenWallJumps) {
    anim.active = { kind: "wallJump", startMs: nowMs, amount: 1, impact: 1 };
  }
  markEventsSeen(anim, player);
  return anim.active === before ? null : anim.active;
}

/** A landing (or roll bounce) squash at `speed`: light ones squash `landMinAmount`, full ones 1. */
function landSquash(
  speed: number,
  frame: { squash: SquashTunables; nowMs: number }
): NonNullable<BlobAnim["active"]> {
  const { squash, nowMs } = frame;
  const impact = Math.min(1, speed / squash.landFullImpact);
  const amount = squash.landMinAmount + (1 - squash.landMinAmount) * impact;
  return { kind: "land", startMs: nowMs, amount, impact };
}

/**
 * Landing squash progress `ms` after touchdown (owner, soft-landing): eases down to 1 over the
 * sink time, then springs back through a damped wobble (negative = the rebound stretch), never
 * held still. 0 once it has played out.
 */
export function landSquashCurve(
  ms: number,
  frame: { land: SquashTunables["land"]; impact: number }
): number {
  const { land, impact } = frame;
  const [lightSink, fullSink] = land.sinkSeconds;
  const sinkMs = (lightSink + (fullSink - lightSink) * impact) * 1000;
  if (ms < 0) return 0;
  if (ms < sinkMs) return Math.sin((ms / sinkMs) * (Math.PI / 2));
  const t = (ms - sinkMs) / (land.seconds * 1000);
  if (t >= 1) return 0;
  return Math.exp(-land.damping * t) * Math.cos(land.wobbles * Math.PI * t) * (1 - t);
}

function markEventsSeen(anim: BlobAnim, player: PlayerState): void {
  anim.seenLandings = player.landCount;
  anim.seenRollBounces = player.rollBounceCount;
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
  const ms = frame.atMs - active.startMs;
  let remaining: number;
  if (active.kind === "land") {
    remaining = landSquashCurve(ms, { land: frame.squash.land, impact: active.impact });
  } else {
    const t = ms / (shape.seconds * 1000);
    if (t >= 1 || t < 0) return { sx: 1, sy: 1 };
    remaining = 1 - easeOutQuad(t);
  }
  if (remaining === 0) return { sx: 1, sy: 1 };
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

/**
 * What the blob touches, as the render layer reads it. `PlayerState` fits as is; `stepContactHold`
 * gives a steadied copy.
 */
export interface SurfaceContact {
  grounded: boolean;
  /** Radians, + rising right. */
  groundAngle: number;
  wallDir: -1 | 0 | 1;
}

/** Per-player contact memory kept by the render layer. */
export interface ContactHold {
  contact: SurfaceContact;
  /** Render clock when the sim last reported the ground / a wall. */
  groundAtMs: number;
  wallAtMs: number;
  seenJumps: number;
  seenWallJumps: number;
}

export const createContactHold = (player: PlayerState): ContactHold => ({
  contact: { grounded: player.grounded, groundAngle: player.groundAngle, wallDir: player.wallDir },
  groundAtMs: -Infinity,
  wallAtMs: -Infinity,
  seenJumps: player.jumpCount,
  seenWallJumps: player.wallJumpCount,
});

/**
 * Steadies the sim's contact for drawing (leg-locomotion D5). Where a slope is as steep as a wall
 * the sim slides the blob off and lands it again, so `grounded` and `wallDir` can flip on every
 * step; drawn straight, the feet, the lean and the shadow flicker. A contact the sim just
 * reported is kept for `seconds` after it is gone. A jump or wall-jump lets go at once.
 */
export function stepContactHold(
  hold: ContactHold,
  frame: { player: PlayerState; nowMs: number; seconds: number }
): SurfaceContact {
  const { player, nowMs } = frame;
  const { contact } = hold;
  const jumped = player.jumpCount !== hold.seenJumps || player.wallJumpCount !== hold.seenWallJumps;
  hold.seenJumps = player.jumpCount;
  hold.seenWallJumps = player.wallJumpCount;
  // A clock that jumped back (tab switch, reset) holds nothing.
  const expired = (sinceMs: number): boolean =>
    jumped || nowMs < sinceMs || nowMs - sinceMs > frame.seconds * 1000;
  if (player.grounded) {
    contact.groundAngle = player.groundAngle;
    hold.groundAtMs = nowMs;
  }
  contact.grounded = player.grounded || (contact.grounded && !expired(hold.groundAtMs));
  if (player.wallDir !== 0) {
    contact.wallDir = player.wallDir;
    hold.wallAtMs = nowMs;
  }
  if (expired(hold.wallAtMs)) contact.wallDir = 0;
  return contact;
}

/**
 * Flat contact shadow while airborne over ground within range; null otherwise. `contact` is the
 * steadied contact when the caller has one.
 */
export function blobShadow(
  player: PlayerState,
  contact: SurfaceContact = player
): BlobShadow | null {
  if (contact.grounded || player.grounded || player.groundBelowY === null) return null;
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
  frame: {
    player: PlayerState;
    squash: SquashTunables;
    nowMs: number;
    crouch?: CrouchTunables;
    /** Steadied contact for the shadow; the player's own when left out. */
    contact?: SurfaceContact;
  }
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
    shadow: blobShadow(player, frame.contact),
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

/** Velocity kick for a squash moment: landings and roll bounces sink it, jumps leave it behind. */
export function kickHelmetForSquash(
  wobble: HelmetWobble,
  moment: { kind: SquashKind; amount: number; vx: number; rolling: boolean },
  helmet: HelmetTunables
): void {
  const side = Math.sign(moment.vx);
  if (moment.kind === "land") {
    wobble.drop.velocity += helmet.landDrop * moment.amount;
    // A roll bounce also rocks it, against the roll.
    if (moment.rolling) wobble.tilt.velocity -= side * helmet.hitTilt * 0.5 * moment.amount;
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
 * sim state. One sprung angle says which way the soles face (leg-locomotion D1): the slope under
 * the blob, the wall it touches, or a tilt that trails the flight in the air. Both feet sit side by
 * side around the body circle on that side and step along the surface with the distance moved, so
 * floor, slope and wall are one pose, turned. A splay kicked by landings and jumps rides on top.
 * Pure TS so the curves are unit-tested; the renderer only applies the numbers. Never feeds back
 * into the sim.
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
  /** Lag of the surface angle behind its target (rad). */
  angle: DampedSpring;
  /** Outward spread (rad; positive = feet spread, outer ends up). */
  splay: DampedSpring;
  /** Angle target of the last step, so a target jump becomes spring offset. */
  lastAngleTarget: number;
  /** Distance moved along the surface (world units); the step cycle runs on it. */
  travel: number;
  lastX: number;
  lastY: number;
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
  angle: createDampedSpring(),
  splay: createDampedSpring(),
  lastAngleTarget: 0,
  // On flat ground the travel is the x position, so the step phase is the same for every viewer.
  travel: player.x,
  lastX: player.x,
  lastY: player.y,
  seenLandings: player.landCount,
  seenJumps: player.jumpCount,
  seenWallJumps: player.wallJumpCount,
  lastMs: null,
  feet: [restFoot(), restFoot()],
});

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const smoothstep = (t: number): number => t * t * (3 - 2 * t);

interface FeetFrame {
  player: PlayerState;
  feet: FeetTunables;
  /** Body radius R, world units. */
  r: number;
  /** Body horizontal scale this frame (the feet ride the body's width). */
  bodySx: number;
  /** Height of a foot's centre above its sole, world units. */
  footCentre: number;
  /** Lean the blob's root already carries for the slope (rad, clockwise); the feet turn the rest. */
  rootLean: number;
  /** Steadied contact (`stepContactHold`); the player's own when left out. */
  contact?: SurfaceContact;
  nowMs: number;
}

/** A frame plus the surface under the feet this step. */
interface FeetStep extends FeetFrame {
  /** Slope of that surface (rad, + rising right; a wall is ±90°), or null in the air. */
  slope: number | null;
  /** Whether that surface is the ground. */
  onGround: boolean;
}

/** Moves further than this many R in one step (a respawn, a teleport) don't count as travel. */
const MAX_STEP_TRAVEL = 4;

/** The surface the feet stand on: the ground, else the wall the blob touches, else none. */
function surfaceSlope(contact: SurfaceContact): number | null {
  if (contact.grounded) return contact.groundAngle;
  if (contact.wallDir !== 0) return contact.wallDir * (Math.PI / 2);
  return null;
}

/** Splay kicks for sim events since the last step. */
function noteFeetEvents(motion: FeetMotion, frame: FeetFrame): void {
  const { player, feet } = frame;
  if (player.landCount !== motion.seenLandings && player.lastLandingSpeed >= MIN_LANDING_SPEED) {
    motion.splay.velocity += feet.landKick;
  }
  if (player.jumpCount !== motion.seenJumps) motion.splay.velocity -= feet.jumpKick;
  if (player.wallJumpCount !== motion.seenWallJumps) motion.splay.velocity -= feet.jumpKick;
  motion.seenLandings = player.landCount;
  motion.seenJumps = player.jumpCount;
  motion.seenWallJumps = player.wallJumpCount;
}

/** Air tilt target: feet trail the horizontal speed and droop (rising) or flare (falling). */
function airTiltTarget(step: FeetStep): number {
  if (step.onGround) return 0;
  return -clamp(step.player.vx / step.feet.airTiltSpeed, -1, 1) * step.feet.airTilt;
}

/** Adds the distance moved along the surface since the last step (sideways in the air). */
function noteTravel(motion: FeetMotion, step: FeetStep): void {
  const { player } = step;
  const slope = step.slope ?? 0;
  const dx = player.x - motion.lastX;
  const dy = player.y - motion.lastY;
  motion.lastX = player.x;
  motion.lastY = player.y;
  // The surface runs along (cos, -sin): up a slope that rises to the right, up a right wall.
  const moved = dx * Math.cos(slope) - dy * Math.sin(slope);
  if (Math.abs(moved) < MAX_STEP_TRAVEL * step.r) motion.travel += moved;
}

/**
 * Where the soles face, in the root's frame (rad, clockwise): flat on the surface under the feet,
 * or the air tilt. A rolling blob's feet ride the spin.
 */
function angleTarget(step: FeetStep): number {
  const { player, slope } = step;
  if (slope === null || player.rollSource !== null) return airTiltTarget(step);
  return -slope - step.rootLean;
}

function stepSprings(motion: FeetMotion, step: FeetStep, dt: number): void {
  const { feet } = step;
  const target = angleTarget(step);
  // A jump in the target leaves the drawn angle behind; the spring pulls it after, so slope,
  // wall and air hand over without a snap.
  motion.angle.value -= target - motion.lastAngleTarget;
  motion.lastAngleTarget = target;
  stepDampedSpring(motion.angle, feet.surface, dt);
  stepDampedSpring(motion.splay, feet, dt);
  motion.splay.value = clampAbs(motion.splay.value, feet.maxSplay);
}

/** Stepping arc of foot `i` while moving on a surface: lift, forward swing and toe tilt. */
function stepCycle(motion: FeetMotion, step: FeetStep, i: number): FootPose {
  const { player, feet, r, slope } = step;
  if (slope === null) return restFoot();
  const along = player.vx * Math.cos(slope) - player.vy * Math.sin(slope);
  const speed = Math.abs(along);
  if (speed < 20) return restFoot();
  const k = Math.min(1, speed / feet.fullStepSpeed);
  // The feet are half a cycle apart; a foot moves forward while it is lifted.
  const phase = motion.travel / (feet.stride * r) + i * Math.PI;
  const up = Math.max(0, Math.sin(phase));
  return {
    // The phase runs with the travel, so the swing already points along the run.
    x: -Math.cos(phase) * feet.stepSwing * r * k,
    y: -up * feet.stepLift * r * k,
    // The lifted foot tips its toe up, toward the run.
    rotation: -Math.sign(along) * up * feet.stepTilt * k,
  };
}

/** Writes foot `i` (0 = left): its place in the surface frame, turned around the body circle. */
function placeFoot(motion: FeetMotion, step: FeetStep, i: number): void {
  const side = i === 0 ? -1 : 1;
  const { r, bodySx, player, feet } = step;
  const cycle = stepCycle(motion, step, i);
  const splay = motion.splay.value;
  // In the air, rising feet droop at their outer ends and falling feet flare up.
  const droop =
    step.slope === null ? clamp(-player.vy / feet.airTiltSpeed, -1, 1) * feet.airTilt : 0;
  const angle = motion.lastAngleTarget + motion.angle.value;
  // The foot centre at rest sits this far under the body circle's centre.
  const rest = player.width / 2 - step.footCentre;
  const across = side * (FOOT_SPACING + SPLAY_SPREAD * splay) * r * bodySx + cycle.x;
  const down = rest + cycle.y;
  const foot = motion.feet[i]!;
  foot.x = across * Math.cos(angle) - down * Math.sin(angle);
  foot.y = across * Math.sin(angle) + down * Math.cos(angle) - rest;
  foot.rotation = angle + cycle.rotation + side * (droop - splay);
}

export type GroundTiltTunables = GameTunables["feel"]["groundTilt"];

/** Per-player lean memory kept by the render layer (slope-walking D4). */
export interface GroundTilt {
  /** Offset from the target, pulled toward 0. */
  spring: DampedSpring;
  /** The last target lean, radians clockwise. */
  target: number;
  lastMs: number | null;
}

export const createGroundTilt = (): GroundTilt => ({
  spring: createDampedSpring(),
  target: 0,
  lastMs: null,
});

/**
 * Body lean toward the ground (slope-walking D4): `share` of the slope under the feet, at most
 * `maxAngle`, level in the air; a new target eases in on the spring. Returns radians, clockwise
 * (a slope rising to the right leans the blob counter-clockwise, into the hill).
 */
export function stepGroundTilt(
  tilt: GroundTilt,
  frame: { groundAngle: number; grounded: boolean; nowMs: number; tunables: GroundTiltTunables }
): number {
  const { tunables } = frame;
  const lean = frame.grounded ? clampAbs(tunables.share * frame.groundAngle, tunables.maxAngle) : 0;
  const target = -lean;
  // A target jump becomes spring offset, so the lean eases toward it instead of snapping.
  tilt.spring.value += tilt.target - target;
  tilt.target = target;
  const dt = tilt.lastMs === null ? 0 : Math.max(0, (frame.nowMs - tilt.lastMs) / 1000);
  tilt.lastMs = frame.nowMs;
  stepDampedSpring(tilt.spring, tunables, dt);
  return groundTiltLean(tilt);
}

/** The lean after the last `stepGroundTilt` (rad, clockwise); the feet turn the rest of the slope. */
export const groundTiltLean = (tilt: GroundTilt): number => tilt.target + tilt.spring.value;

/** Advances the foot motion to `nowMs` and writes both feet into `motion.feet`. */
export function stepFeetMotion(motion: FeetMotion, frame: FeetFrame): [FootPose, FootPose] {
  // A clock that stalls or jumps back (tab switch, reset) steps nothing.
  const dt = motion.lastMs === null ? 0 : Math.max(0, (frame.nowMs - motion.lastMs) / 1000);
  motion.lastMs = frame.nowMs;
  const contact = frame.contact ?? frame.player;
  const step: FeetStep = { ...frame, slope: surfaceSlope(contact), onGround: contact.grounded };
  noteFeetEvents(motion, frame);
  noteTravel(motion, step);
  stepSprings(motion, step, dt);
  placeFoot(motion, step, 0);
  placeFoot(motion, step, 1);
  return motion.feet;
}
