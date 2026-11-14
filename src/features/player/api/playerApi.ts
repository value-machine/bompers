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
  createPlayersView,
  syncPlayersView,
  type PlayersView,
} from "@/features/player/services/playerRenderer";
