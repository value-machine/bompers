/** Public seam of the knockout feature: the knockout simulation (render-only) and its layer. */
export {
  createKnockoutWorld,
  CRUSH_PANCAKE,
  knockoutBodies,
  noteKnockoutEvents,
  stepKnockouts,
  type NoteKnockoutsArgs,
  type StepKnockoutsArgs,
} from "@/features/knockout/services/knockoutSim";
export {
  createKnockoutView,
  syncKnockoutView,
  type KnockoutFrame,
  type KnockoutView,
} from "@/features/knockout/services/knockoutRenderer";
export type {
  Knockout,
  KnockoutBody,
  KnockoutWorld,
} from "@/features/knockout/services/knockoutSim";
