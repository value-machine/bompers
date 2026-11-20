import { useRef } from "react";
import { GAME_PALETTE, toCssColor } from "@/shared/config/gamePalette";
import { usePixiApp } from "@/shared/hooks/usePixiApp";
import { DebugInkLegend } from "@/features/match/components/DebugInkLegend";
import { useGameSession, type MatchSetup } from "@/features/match/hooks/useGameSession";
import { PauseMenu, usePauseMenu } from "@/features/pause/api/pauseApi";

/** Canvas colours: the hint sits on the canvas, which looks the same in either UI mode. Ink on the HUD card cream, so the hint reads over sky and dark terrain alike. */
const HINT_STYLE = {
  color: toCssColor(GAME_PALETTE.ink),
  backgroundColor: toCssColor(GAME_PALETTE.hud.card),
};

const CONTROLS_HINT =
  "Left keys: A/D move · W/Space jump · S aim down · F bomp — Right keys: ←/→ · ↑ · ↓ · / or Enter bomp — pads: stick · A · RT — hold Q / Backspace / Back to respawn — Esc / Start pause — M sound on/off";

export interface GameViewProps {
  /** One object per start from the lobby (a new object starts a new match). */
  setup: MatchSetup;
  /** Back after the round ended, or Main menu in the pause menu: return to the lobby (players and settings kept). */
  onExitToLobby: () => void;
}

/**
 * The game canvas: fills its parent and runs rounds of the lobby's setup (level, settings,
 * players). After a round: jump = rematch, back = lobby. Esc / Start pauses with the menu.
 */
export const GameView = ({ setup, onExitToLobby }: GameViewProps) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(hostRef, { background: GAME_PALETTE.sky.top });
  const pause = usePauseMenu(onExitToLobby);
  useGameSession(app, setup, { onExitToLobby, pause: pause.link });

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" data-testid="game-canvas-host" />
      <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs">
        <span className="rounded-full px-3 py-1" style={HINT_STYLE}>
          {CONTROLS_HINT}
        </span>
      </p>
      <DebugInkLegend />
      <PauseMenu
        menu={pause.menu}
        focusedRow={pause.focusedRow}
        sound={pause.sound}
        onAction={pause.dispatch}
      />
    </div>
  );
};
