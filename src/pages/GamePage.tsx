import { useState } from "react";
import { useLevelLibrary } from "@/features/level-file/api/levelFileApi";
import { LobbyScreen, useLobby } from "@/features/lobby/api/lobbyApi";
import type { MatchSetup } from "@/features/match/api/matchApi";
import { GameView } from "@/features/match/components/GameView";
import { SoundStatusCorner } from "@/features/sound/api/soundApi";

/**
 * `/` — the game: lobby → round → result → back to the lobby (players, level and settings
 * kept) or a rematch inside the match. Fills the viewport below the top bar.
 */
export const GamePage = () => {
  const library = useLevelLibrary();
  const lobby = useLobby(library.entries);
  const [match, setMatch] = useState<MatchSetup | null>(null);

  return (
    <div className="relative h-[calc(100dvh-var(--app-toolbar-height))] w-full">
      {match ? (
        <GameView setup={match} onExitToLobby={() => setMatch(null)} />
      ) : (
        <LobbyScreen lobby={lobby} library={library} onStart={setMatch} />
      )}
      <SoundStatusCorner placement={match ? "bottom-right" : "top-right"} />
    </div>
  );
};
