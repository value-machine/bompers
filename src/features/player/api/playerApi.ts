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
  endRoll,
  isRolling,
  reactToHit,
  rollLockFor,
  startRoll,
  type HitReactionArgs,
  type StartRollArgs,
} from "@/features/player/services/roll";
export type { RollSource } from "@/features/player/types/player.types";
export type { BlobPoseOverlay } from "@/features/player/services/blobPose";
export {
  createPlayersView,
  syncPlayersView,
  type BlobWeapon,
  type PlayersView,
} from "@/features/player/services/playerRenderer";
