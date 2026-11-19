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
  isRollLocked,
  reactToHit,
  rollLockFor,
  startRoll,
  weaponAim,
  type HitReactionArgs,
  type StartRollArgs,
} from "@/features/player/services/roll";
export type { RollHoldButton, RollSource } from "@/features/player/types/player.types";
export { PANIC_PUPIL_SCALE, type BlobPoseOverlay } from "@/features/player/services/blobPose";
export { drawLooseHelmet, drawLooseTube } from "@/features/player/services/blobShapes";
export {
  createPlayersView,
  syncPlayersView,
  type BlobWeapon,
  type PlayersView,
} from "@/features/player/services/playerRenderer";
