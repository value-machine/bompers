/** Public seam of the fire feature: fire on the terrain field, the torch spray, the fire layers. */
export type {
  BlobFireMoment,
  BurningBlob,
  FireState,
  TorchSpray,
} from "@/features/fire/types/fire.types";
export {
  catchFire,
  douseBlob,
  isBurning,
  panicInputs,
  stepBurningBlobs,
  type BurnDown,
  type StepBurningBlobsArgs,
} from "@/features/fire/services/burningBlobs";
export {
  burningSamples,
  canBurn,
  createFireState,
  ignite,
  stepFire,
} from "@/features/fire/services/fireSim";
export { sprayTorch, type TorchSprayArgs } from "@/features/fire/services/torch";
export { burningBlobPoses } from "@/features/fire/services/blobFireRenderer";
export {
  createFireView,
  syncFireView,
  type FireFrame,
  type FireView,
} from "@/features/fire/services/fireRenderer";
