/** Public seam of the player feature: state shape, controller, body contacts and roll. The blob's look is the blob-look feature. */
export type { PlayerState } from "@/features/player/types/player.types";
export {
  createPlayer,
  hurtBox,
  hurtCenter,
  hurtHeight,
  moveAxis,
  placePlayer,
  playerBody,
  stepPlayers,
  type ContactArgs,
  type StepPlayersArgs,
} from "@/features/player/services/playerController";
export {
  resolveBodyContacts,
  respondToBodyContact,
  type BodyContact,
  type ResolveBodyContactsArgs,
} from "@/features/player/services/bodyCollision";
export { escapeSolid, type EscapeResult } from "@/features/player/services/solidEscape";
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
