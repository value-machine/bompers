import type { Vec2 } from "@/shared/types/gameGeometry.types";

/**
 * A moving part's motion, read from a level file's `data-motion` (LEVEL_FORMAT § 11). Offsets
 * are world units relative to the part's rest pose (where its shapes are drawn); time is the
 * round's sim time, so a pose is a pure function of time (moving-parts D7).
 */
export type MotionKind = "slide" | "path" | "spin" | "swing";

/** Rotation sense on screen (y down): 1 = clockwise, -1 = counter-clockwise. */
export type MotionDirection = 1 | -1;

interface MotionTiming {
  /** Seconds for one full cycle. */
  periodS: number;
  /** Fraction of a period the part starts ahead, in [0, 1). */
  phase: number;
}

export type LevelMotion =
  /** Back and forth between the rest pose and `offset`, eased at both ends. */
  | (MotionTiming & { kind: "slide"; offset: Vec2 })
  /** A closed loop rest → offsets[0] → … → rest at constant speed. */
  | (MotionTiming & { kind: "path"; offsets: readonly Vec2[] })
  /** One full turn per period about the pivot. */
  | (MotionTiming & { kind: "spin"; direction: MotionDirection })
  /** Pendulum: ± `degrees` about the pivot, starting at rest. */
  | (MotionTiming & { kind: "swing"; degrees: number; direction: MotionDirection });

/** Where a part is at one moment: rotate about the pivot by `angle`, then shift by `dx, dy`. */
export interface MotionPose {
  dx: number;
  dy: number;
  /** Radians; positive turns clockwise on screen (y down). */
  angle: number;
}
