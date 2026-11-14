import { GameView } from "@/features/match/components/GameView";

/** `/` — the game. Fills the viewport below the top bar. */
export const GamePage = () => (
  <div className="h-[calc(100dvh-var(--app-toolbar-height))] w-full">
    <GameView />
  </div>
);
