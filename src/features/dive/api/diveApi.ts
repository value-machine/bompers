/**
 * Public seam of the dive feature (the unarmed attack): state slice, the sim system, the hit
 * events combat will consume, and the render pieces.
 */
export type {
  DiveHit,
  DiveMotion,
  DivePhase,
  DiveState,
  HitTally,
  HitZone,
} from "@/features/dive/types/dive.types";
export {
  activeDiveOption,
  createDiveState,
  selectDiveOption,
  stepDives,
  type StepDivesArgs,
} from "@/features/dive/services/diveSim";
export { classifyHitZone, hitDamage } from "@/features/dive/services/hitZone";
export {
  createDiveView,
  diveBlobPoses,
  syncDiveView,
  type DiveView,
} from "@/features/dive/services/diveRenderer";
