/**
 * Fixed-timestep loop ("fix your timestep" accumulator): the simulation always advances in
 * equal steps whatever the display rate, so movement and collisions are deterministic and
 * testable. Rendering happens once per frame after the steps.
 */
export interface FixedStepClock {
  /** Seconds of real time not yet simulated. */
  accumulator: number;
}

export interface FixedStepOptions {
  /** Seconds per fixed step (1 / stepHz). */
  stepSeconds: number;
  /** Cap on steps per frame; time beyond it is dropped (a stalled tab must not fast-forward). */
  maxSteps: number;
}

export interface FixedStepAdvance {
  clock: FixedStepClock;
  /** How many fixed steps to run this frame. */
  steps: number;
}

export const createFixedStepClock = (): FixedStepClock => ({ accumulator: 0 });

/** Adds a frame's elapsed seconds and returns how many fixed steps are due. */
export function advanceFixedStep(
  clock: FixedStepClock,
  frameSeconds: number,
  options: FixedStepOptions
): FixedStepAdvance {
  const { stepSeconds, maxSteps } = options;
  const total = clock.accumulator + Math.max(0, frameSeconds);
  // Epsilon absorbs float error so 1/60 s yields exactly two 1/120 s steps.
  const due = Math.floor(total / stepSeconds + 1e-9);
  const steps = Math.min(due, maxSteps);
  const remainder = due > maxSteps ? 0 : Math.max(0, total - steps * stepSeconds);
  return { clock: { accumulator: remainder }, steps };
}
