/**
 * Public seam of the dive feature (the unarmed attack): state slice, the sim system, the entry
 * for combat's `unarmedAttack` hook, and the render pieces.
 */
export type { DiveHit, DiveMotion, DivePhase, DiveState } from "@/features/dive/types/dive.types";
export {
  createDiveState,
  isDiveSpent,
  refillDive,
  requestDive,
  resetDive,
  stepDives,
  type StepDivesArgs,
} from "@/features/dive/services/diveSim";
export {
  createDiveView,
  diveBlobPoses,
  syncDiveView,
  type DiveView,
} from "@/features/dive/services/diveRenderer";
