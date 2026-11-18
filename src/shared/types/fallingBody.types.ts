/** Point test for solid terrain (the arena grid's `isSolidAt` fits). */
export type SolidAt = (x: number, y: number) => boolean;

/** A circle falling, bouncing and rolling against terrain (`shared/utils/fallingBody.ts`). */
export interface FallingBody {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  /** Turn, radians; rolls with the ground speed while touching a floor. */
  angle: number;
  /** Turn speed, radians / s, kept while airborne. */
  spin: number;
}
