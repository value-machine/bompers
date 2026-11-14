/** Public seam of the match feature: the simulation entry (pages mount `components/GameView`). */
export {
  applyLevelSettings,
  createGameState,
  stepGame,
  type CreateGameStateArgs,
  type GameState,
  type MatchRoundState,
} from "@/features/match/services/gameSim";
export type { MatchSetup } from "@/features/match/hooks/useGameSession";
