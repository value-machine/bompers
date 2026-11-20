import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { BlobPoseOverlay } from "@/features/blob-look/api/blobLookApi";
import type { DiveMotion } from "@/features/dive/types/dive.types";
import { easeOutBack, easeOutQuad } from "@/shared/utils/easing";

/**
 * Render-only read of a dive (DESIGN_LANGUAGE § 6), driven by the sim's phase timers:
 * a deep crouch that leans toward the target (the telegraph) → a launch stretch that snaps long
 * and settles into the flight stretch, helmet first → on a hit the attacker squashes against the
 * victim and springs upright; on a wall a flat bonk squash; the victim takes the "bash hit
 * taken" squash. Pure; never feeds back into the sim.
 */
type Scale = { sx: number; sy: number };

const UPRIGHT: Scale = { sx: 1, sy: 1 };
const WINDUP_SQUASH: Scale = { sx: 1.32, sy: 0.7 };
/** The first frames of the flight overshoot the stretch, then ease to the cruise shape. */
const LAUNCH_STRETCH: Scale = { sx: 0.68, sy: 1.46 };
const TRAVEL_STRETCH: Scale = { sx: 0.82, sy: 1.24 };
const LAUNCH_SETTLE_SECONDS = 0.08;
const BONK_SQUASH: Scale = { sx: 1.34, sy: 0.7 };
/** The attacker flattening against the victim, then springing off. */
const RICOCHET_SQUASH: Scale = { sx: 1.3, sy: 0.74 };
const RICOCHET_SECONDS = 0.16;
/** DESIGN_LANGUAGE § 6 "Bash hit taken": (1.15, 0.88) for 100 ms. */
const HIT_SQUASH: Scale = { sx: 1.15, sy: 0.88 };
const HIT_SQUASH_SECONDS = 0.1;
/** How far the wind-up leans toward the dive direction (share of the full turn). */
const WINDUP_LEAN = 0.35;

/** Rotation that points the blob's top (the helmet) along a direction; y is down. */
const headfirstAngle = (dirX: number, dirY: number): number => Math.atan2(dirX, -dirY);

const clamp01 = (t: number): number => Math.min(1, Math.max(0, t));
const mix = (from: number, to: number, t: number): number => from + (to - from) * t;
const mixScale = (from: Scale, to: Scale, t: number): Scale => ({
  sx: mix(from.sx, to.sx, t),
  sy: mix(from.sy, to.sy, t),
});

const phaseProgress = (motion: DiveMotion): number =>
  motion.phaseDuration > 0 ? clamp01(motion.phaseSeconds / motion.phaseDuration) : 1;

/** Poses of a blob that is not diving: springing off a hit it landed, or squashed by one it took. */
function reactionPose(motion: DiveMotion, staggerSeconds: number): BlobPoseOverlay | null {
  if (motion.sinceRicochet < RICOCHET_SECONDS) {
    const t = motion.sinceRicochet / RICOCHET_SECONDS;
    const angle = headfirstAngle(motion.dirX, motion.dirY);
    return {
      rotation: angle * (1 - easeOutQuad(t)),
      ...mixScale(RICOCHET_SQUASH, UPRIGHT, easeOutBack(t)),
    };
  }
  const sinceHit = staggerSeconds - motion.stagger;
  if (motion.stagger <= 0 || sinceHit >= HIT_SQUASH_SECONDS) return null;
  return { rotation: 0, ...mixScale(HIT_SQUASH, UPRIGHT, sinceHit / HIT_SQUASH_SECONDS) };
}

/**
 * A dash press that could not start a dive (dash-feel lap, light tier): a quick "no" head shake,
 * two wobbles fading out over 180 ms (squash window). Rotation only, so the volume stays put.
 */
export const DENIED_SHAKE_SECONDS = 0.18;
const DENIED_SHAKE_RADIANS = 0.2;
const DENIED_SHAKE_WOBBLES = 2;

/** The head-shake rotation `sinceDenied` seconds after a denied press (0 once it is over). */
export function deniedShake(sinceDenied: number): number {
  if (sinceDenied >= DENIED_SHAKE_SECONDS) return 0;
  const t = sinceDenied / DENIED_SHAKE_SECONDS;
  return DENIED_SHAKE_RADIANS * Math.sin(t * Math.PI * 2 * DENIED_SHAKE_WOBBLES) * (1 - t);
}

/** The overlay for one player this frame, or null for the plain movement pose. */
export function diveBlobPose(
  motion: DiveMotion,
  tunables: Pick<GameTunables["dive"], "staggerSeconds">
): BlobPoseOverlay | null {
  const pose = phasePose(motion, tunables);
  const shake = deniedShake(motion.sinceDenied);
  if (shake === 0) return pose;
  const base = pose ?? { rotation: 0, ...UPRIGHT };
  return { ...base, rotation: base.rotation + shake };
}

function phasePose(
  motion: DiveMotion,
  tunables: Pick<GameTunables["dive"], "staggerSeconds">
): BlobPoseOverlay | null {
  const angle = headfirstAngle(motion.dirX, motion.dirY);
  const t = phaseProgress(motion);
  switch (motion.phase) {
    case "windup":
      return {
        rotation: angle * WINDUP_LEAN * easeOutQuad(t),
        ...mixScale(UPRIGHT, WINDUP_SQUASH, easeOutQuad(t)),
      };
    case "travel": {
      const settle = clamp01(motion.phaseSeconds / LAUNCH_SETTLE_SECONDS);
      return { rotation: angle, ...mixScale(LAUNCH_STRETCH, TRAVEL_STRETCH, easeOutQuad(settle)) };
    }
    case "recovery":
      return {
        rotation: angle * (1 - easeOutQuad(t)),
        ...mixScale(motion.bonked ? BONK_SQUASH : TRAVEL_STRETCH, UPRIGHT, easeOutQuad(t)),
      };
    default:
      return reactionPose(motion, tunables.staggerSeconds);
  }
}
