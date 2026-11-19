/** Public seam of the blob-look feature: how a blob is drawn (pose, shapes, the players layer). */
export { PANIC_PUPIL_SCALE, type BlobPoseOverlay } from "@/features/blob-look/services/blobPose";
export { drawLooseHelmet, drawLooseTube } from "@/features/blob-look/services/blobShapes";
export {
  createPlayersView,
  syncPlayersView,
  type BlobWeapon,
  type PlayersView,
} from "@/features/blob-look/services/playerRenderer";
