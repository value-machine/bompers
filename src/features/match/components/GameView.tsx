import { useRef } from "react";
import { GAME_PALETTE, toCssColor } from "@/shared/config/gamePalette";
import { usePixiApp } from "@/shared/hooks/usePixiApp";
import { useGameSession, type MatchSetup } from "@/features/match/hooks/useGameSession";

/** Canvas colours: the hint sits on the canvas, which looks the same in either UI mode. Ink on the HUD card cream, so the hint reads over sky and dark terrain alike. */
const HINT_STYLE = {
  color: toCssColor(GAME_PALETTE.ink),
  backgroundColor: toCssColor(GAME_PALETTE.hud.card),
};

const CONTROLS_HINT =
  "Left keys: A/D move · W/Space jump · F fire — Right keys: ←/→ · ↑ · / or Enter — pads: stick · A · RT";

export interface GameViewProps {
  /** One object per start from the lobby (a new object starts a new match). */
  setup: MatchSetup;
  /** Back pressed after the round ended: return to the lobby (players and settings kept). */
  onExitToLobby: () => void;
}

/**
 * The game canvas: fills its parent and runs rounds of the lobby's setup (level, settings,
 * players). After a round: jump = rematch, back = lobby.
 */
export const GameView = ({ setup, onExitToLobby }: GameViewProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(hostRef, { background: GAME_PALETTE.sky.top });
  useGameSession(app, setup, onExitToLobby);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" data-testid="game-canvas-host" />
      <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs">
        <span className="rounded-full px-3 py-1" style={HINT_STYLE}>
          {CONTROLS_HINT}
        </span>
      </p>
    </div>
  );
};
