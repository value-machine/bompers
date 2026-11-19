/** Public seam of the player feature: state shape, controller, body contacts and roll. The blob's look is the blob-look feature. */
export type { PlayerState } from "@/features/player/types/player.types";
export {
  createPlayer,
  hurtBox,
  hurtCenter,
  hurtHeight,
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
