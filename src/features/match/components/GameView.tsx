import { useRef } from "react";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { usePixiApp } from "@/shared/hooks/usePixiApp";
import { useGameSession } from "@/features/match/hooks/useGameSession";

/** Canvas ink as CSS: the hint sits on the sky, which looks the same in light and dark mode. */
const CANVAS_INK = `#${GAME_PALETTE.ink.toString(16).padStart(6, "0")}`;

const CONTROLS_HINT =
  "P1: A/D move · W/Space jump · F fire — P2: ←/→ · ↑ · / — gamepads join slots 3–4";

/** The game canvas: fills its parent and runs one match inside it. */
export const GameView = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(hostRef, { background: GAME_PALETTE.sky.top });
  useGameSession(app);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={hostRef} className="absolute inset-0" data-testid="game-canvas-host" />
      <p
        className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs"
        style={{ color: CANVAS_INK }}
      >
        {CONTROLS_HINT}
      </p>
    </div>
  );
};
