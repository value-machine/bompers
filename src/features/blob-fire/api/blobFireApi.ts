/** Public seam of the blob-fire feature: blobs that catch fire, burn, pass it on and go out. */
export type {
  BlobFireMoment,
  BlobFireState,
  BurningBlob,
} from "@/features/blob-fire/types/blobFire.types";
export {
  burningGroundNear,
  catchFire,
  createBlobFireState,
  douseBlob,
  isBurning,
  panicInputs,
  stepBurningBlobs,
  type BurnDown,
  type StepBurningBlobsArgs,
} from "@/features/blob-fire/services/burningBlobs";
export {
  burningBlobPoses,
  createBlobFireView,
  syncBlobFireView,
  type BlobFireFrame,
  type BlobFireView,
} from "@/features/blob-fire/services/blobFireRenderer";
