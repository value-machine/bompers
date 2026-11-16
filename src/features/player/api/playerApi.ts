/** Public seam of the player feature: state shape, controller system, render layer. */
export type { PlayerState } from "@/features/player/types/player.types";
export {
  createPlayer,
  placePlayer,
  playerBody,
  stepPlayers,
  type StepPlayersArgs,
} from "@/features/player/services/playerController";
export {
  resolveBodyContacts,
  type BodyContact,
  type ResolveBodyContactsArgs,
} from "@/features/player/services/bodyCollision";
export {
  isTumbling,
  reactToHit,
  startTumble,
  type HitReactionArgs,
} from "@/features/player/services/tumble";
export type { BlobPoseOverlay } from "@/features/player/services/blobPose";
export {
  createPlayersView,
  syncPlayersView,
  type BlobWeapon,
  type PlayersView,
} from "@/features/player/services/playerRenderer";
