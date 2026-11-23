/** Public seam of the ice feature: frozen ground on the terrain field, the freeze ray, the ice layers. */
export type { FreezeSpray, IceBlob, IceBlobMoment, IceState } from "@/features/ice/types/ice.types";
export {
  chillBlob,
  chillSlow,
  holdIcedBlobs,
  icedInputs,
  isFrozen,
  isIced,
  releaseBlob,
  stepFrozenBlobs,
  type StepFrozenBlobsArgs,
} from "@/features/ice/services/frozenBlobs";
export { frozenBlobPoses } from "@/features/ice/services/blobIceRenderer";
export {
  canFreeze,
  createIceState,
  feedCold,
  stepIce,
  thawedCount,
} from "@/features/ice/services/iceSim";
export {
  sprayFreezeRay,
  stepFreezeSprays,
  type FreezeRayArgs,
} from "@/features/ice/services/freezeRay";
export {
  createIceView,
  syncIceView,
  type IceFrame,
  type IceView,
} from "@/features/ice/services/iceRenderer";
