import { useRef } from "react";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { useFileDrop } from "@/shared/hooks/useFileDrop";
import { usePixiApp } from "@/shared/hooks/usePixiApp";
import { LevelImportControl, useLevelSource } from "@/features/level-file/api/levelFileApi";
import { useGameSession } from "@/features/match/hooks/useGameSession";

/** Canvas colours as CSS: the hint sits on the canvas, which looks the same in either UI mode. */
const toCss = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
/** Ink on the HUD card cream, so the hint reads over sky and dark terrain alike. */
const HINT_STYLE = {
  color: toCss(GAME_PALETTE.ink),
  backgroundColor: toCss(GAME_PALETTE.hud.card),
};

const CONTROLS_HINT =
  "P1: A/D move · W/Space jump · F fire — P2: ←/→ · ↑ · / — gamepads join slots 3–4";

/**
 * The game canvas: fills its parent and runs one match on the current level. A level file
 * picked with "Load level" or dropped onto the game replaces the level and restarts the match.
 */
export const GameView = () => {
  const hostRef = useRef<HTMLDivElement>(null);
  const app = usePixiApp(hostRef, { background: GAME_PALETTE.sky.top });
  const levelSource = useLevelSource();
  const onFile = (file: File): void => void levelSource.importFile(file);
  const { isDragging, dropHandlers } = useFileDrop(onFile);
  useGameSession(app, levelSource.level);

  return (
    <div className="relative h-full w-full overflow-hidden" {...dropHandlers}>
      <div ref={hostRef} className="absolute inset-0" data-testid="game-canvas-host" />
      {/* Below the HUD card row (at most 82 px tall), so it never covers the P3 / P4 cards. */}
      <div className="absolute top-24 right-2">
        <LevelImportControl
          report={levelSource.report}
          onFile={onFile}
          onDismiss={levelSource.dismissReport}
        />
      </div>
      {levelSource.loadError && (
        <p role="alert" className="absolute inset-x-0 top-1/2 text-center text-sm">
          {levelSource.loadError}
        </p>
      )}
      {isDragging && (
        <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-4 border-dashed border-primary bg-background/60 text-lg font-medium">
          Drop a level file to play it
        </div>
      )}
      <p className="pointer-events-none absolute bottom-2 left-0 w-full text-center text-xs">
        <span className="rounded-full px-3 py-1" style={HINT_STYLE}>
          {CONTROLS_HINT}
        </span>
      </p>
    </div>
  );
};
