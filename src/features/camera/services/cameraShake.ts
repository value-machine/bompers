import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * Screen shake (DESIGN_LANGUAGE § 6) as a fixed pool of decaying kicks — pure math, run per
 * rendered frame, never in the sim. Each kick decays as (1 − t / seconds)². Live kicks sum as the
 * root of their squares (two equal blasts shake √2 harder, not 2×), capped at `maxPx`. The
 * direction wobbles on two incommensurate sines, so the shake looks random but is deterministic
 * and allocates nothing per frame.
 */
export interface ShakeKick {
  /** Peak screen px; 0 = free slot. */
  px: number;
  startMs: number;
  seconds: number;
}

export interface CameraShake {
  kicks: ShakeKick[];
  /** Reused output of `cameraShakeOffset`. */
  offset: Vec2;
}

export interface ShakeSettings {
  maxPx: number;
  frequencyHz: number;
}

const DEFAULT_CAPACITY = 8;

export function createCameraShake(capacity = DEFAULT_CAPACITY): CameraShake {
  const kicks: ShakeKick[] = [];
  for (let i = 0; i < capacity; i += 1) kicks.push({ px: 0, startMs: 0, seconds: 0 });
  return { kicks, offset: { x: 0, y: 0 } };
}

/** Strength of one kick at `nowMs`, screen px. */
export function kickStrength(kick: ShakeKick, nowMs: number): number {
  if (kick.px <= 0 || kick.seconds <= 0) return 0;
  const t = (nowMs - kick.startMs) / (kick.seconds * 1000);
  if (t < 0 || t >= 1) return 0;
  return kick.px * (1 - t) * (1 - t);
}

/** Adds a kick, reusing a spent slot, or else replacing the weakest one if the new one is stronger. */
export function kickCameraShake(
  shake: CameraShake,
  kick: { px: number; seconds: number; nowMs: number }
): void {
  if (kick.px <= 0 || kick.seconds <= 0) return;
  let weakest: ShakeKick | null = null;
  let weakestPx = Infinity;
  for (const slot of shake.kicks) {
    const px = kickStrength(slot, kick.nowMs);
    if (px < weakestPx) {
      weakest = slot;
      weakestPx = px;
    }
  }
  if (!weakest || weakestPx >= kick.px) return;
  weakest.px = kick.px;
  weakest.seconds = kick.seconds;
  weakest.startMs = kick.nowMs;
}

/** Combined strength of the live kicks (root of squares), capped at `maxPx`. */
export function cameraShakeStrength(shake: CameraShake, nowMs: number, maxPx: number): number {
  let sum = 0;
  for (const kick of shake.kicks) {
    const px = kickStrength(kick, nowMs);
    sum += px * px;
  }
  return Math.min(Math.sqrt(sum), maxPx);
}

/** This frame's screen offset (written into and returned as `shake.offset`). */
export function cameraShakeOffset(
  shake: CameraShake,
  frame: { nowMs: number; settings: ShakeSettings }
): Vec2 {
  const { nowMs, settings } = frame;
  const strength = cameraShakeStrength(shake, nowMs, settings.maxPx);
  const phase = (nowMs / 1000) * settings.frequencyHz * Math.PI * 2;
  shake.offset.x = strength * Math.sin(phase);
  shake.offset.y = strength * Math.sin(phase * 1.37 + 1.1);
  return shake.offset;
}
