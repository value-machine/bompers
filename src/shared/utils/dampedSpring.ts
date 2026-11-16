/**
 * A damped spring pulled toward 0 (render-only wobble, e.g. the helmet). Mutated in place so a
 * per-frame step allocates nothing. Semi-implicit Euler in fixed sub-steps, so a long frame
 * stays stable instead of exploding.
 */
export interface DampedSpring {
  value: number;
  velocity: number;
}

export interface SpringSettings {
  /** Pull toward 0 per unit of offset, 1/s². */
  stiffness: number;
  /** Velocity loss, 1/s. Below 2·√stiffness the spring overshoots (wobbles). */
  damping: number;
}

/** Longest sub-step: stable for stiffness up to a few thousand. */
const MAX_SUBSTEP_SECONDS = 1 / 240;
/** A frame longer than this (tab switch, stall) counts as this long. */
const MAX_FRAME_SECONDS = 0.1;

export const createDampedSpring = (): DampedSpring => ({ value: 0, velocity: 0 });

/** Advances the spring by `dt` seconds. */
export function stepDampedSpring(spring: DampedSpring, settings: SpringSettings, dt: number): void {
  let left = Math.min(Math.max(dt, 0), MAX_FRAME_SECONDS);
  while (left > 0) {
    const h = Math.min(left, MAX_SUBSTEP_SECONDS);
    spring.velocity +=
      (-settings.stiffness * spring.value - settings.damping * spring.velocity) * h;
    spring.value += spring.velocity * h;
    left -= h;
  }
}
