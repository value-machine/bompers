import type { DiveOptionTunables } from "@/shared/types/gameTunables.types";
import type { BlobPoseOverlay } from "@/features/player/api/playerApi";
import type { DiveMotion } from "@/features/dive/types/dive.types";

/**
 * Render-only read of a dive (DESIGN_LANGUAGE § 6): crouch into the wind-up, turn headfirst and
 * stretch along the dive while travelling, squash on a terrain bonk, ease upright in recovery,
 * and the "bash hit taken" squash on a victim. Pure, driven by the sim's phase timers.
 */
const WINDUP_SQUASH = { sx: 1.22, sy: 0.8 };
const TRAVEL_STRETCH = { sx: 0.82, sy: 1.24 };
const BONK_SQUASH = { sx: 1.3, sy: 0.74 };
/** DESIGN_LANGUAGE § 6 "Bash hit taken": (1.15, 0.88) for 100 ms. */
const HIT_SQUASH = { sx: 1.15, sy: 0.88, seconds: 0.1 };

/** Rotation that points the blob's top (the helmet) along a direction; y is down. */
const headfirstAngle = (dirX: number, dirY: number): number => Math.atan2(dirX, -dirY);

const mix = (from: number, to: number, t: number): number => from + (to - from) * t;

const phaseProgress = (motion: DiveMotion): number =>
  motion.phaseDuration > 0 ? Math.min(1, motion.phaseSeconds / motion.phaseDuration) : 1;

function hitSquash(motion: DiveMotion, staggerSeconds: number): BlobPoseOverlay | null {
  const sinceHit = staggerSeconds - motion.stagger;
  if (motion.stagger <= 0 || sinceHit >= HIT_SQUASH.seconds) return null;
  const k = 1 - sinceHit / HIT_SQUASH.seconds;
  return { rotation: 0, sx: mix(1, HIT_SQUASH.sx, k), sy: mix(1, HIT_SQUASH.sy, k) };
}

/** The overlay for one player this frame, or null for the plain movement pose. */
export function diveBlobPose(
  motion: DiveMotion,
  ctx: { option: DiveOptionTunables; staggerSeconds: number }
): BlobPoseOverlay | null {
  const angle = headfirstAngle(motion.dirX, motion.dirY);
  const t = phaseProgress(motion);
  if (motion.phase === "windup") {
    // Lean a third of the way toward the dive while crouching.
    return {
      rotation: (angle / 3) * t,
      sx: mix(1, WINDUP_SQUASH.sx, t),
      sy: mix(1, WINDUP_SQUASH.sy, t),
    };
  }
  if (motion.phase === "travel") {
    return { rotation: angle, sx: TRAVEL_STRETCH.sx, sy: TRAVEL_STRETCH.sy };
  }
  if (motion.phase === "recovery") {
    const from = motion.bonked ? BONK_SQUASH : { sx: 1, sy: 1 };
    return { rotation: angle * (1 - t), sx: mix(from.sx, 1, t), sy: mix(from.sy, 1, t) };
  }
  return hitSquash(motion, ctx.staggerSeconds);
}
