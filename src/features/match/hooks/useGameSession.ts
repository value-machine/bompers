import { useEffect } from "react";
import type { Application, Ticker } from "pixi.js";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { waitForGameFont } from "@/shared/utils/gameFont";
import { advanceFixedStep, createFixedStepClock } from "@/shared/services/gameLoop";
import { createGameInputReader } from "@/shared/services/gameInputService";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import { createGameState, stepGame, type GameState } from "@/features/match/services/gameSim";
import {
  createGameRenderer,
  renderGame,
  type GameRenderer,
} from "@/features/match/services/gameRenderer";
import { isRestartPress } from "@/features/match/services/matchRules";

// Pixi nulls these on destroy although the types say they are always set.
const isAppAlive = (app: Application): boolean =>
  (app.ticker as Ticker | null) !== null && (app.stage as Application["stage"] | null) !== null;

/**
 * Runs matches of `level` on a ready Pixi app (nothing until both are ready; a new level
 * object restarts the match): input → fixed steps of `stepGame` → render, once per Pixi
 * ticker frame. After a round ends, a jump press (past the restart lock) starts a fresh round
 * on the same level and settings. Everything is created in the effect and torn down in
 * its cleanup, so a StrictMode remount starts a clean session.
 */
const clearStage = (app: Application): void => {
  app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
};

/** How long a session waits for Fredoka before it starts with the fallback face (visual-pass D5). */
const FONT_WAIT_MS = 1500;

/** Starts a session on a live app; returns its teardown. */
function startSession(app: Application, level: LevelDefinition): () => void {
  const tunables = DEFAULT_GAME_TUNABLES;
  const stepSeconds = 1 / tunables.sim.stepHz;
  const startRound = (): { state: GameState; renderer: GameRenderer } => {
    const state = createGameState({ level, tunables });
    return { state, renderer: createGameRenderer(app, state) };
  };
  let round = startRound();
  // Level authors (often AI agents) see what was corrected; the game still runs.
  const { levelWarnings } = round.state;
  if (levelWarnings.length > 0) console.warn("Level warnings:", levelWarnings);
  const input = createGameInputReader(window);
  let clock = createFixedStepClock();
  let previousInputs: PlayerInputs = [];

  /** True when this frame's jump press restarted the round (that press is then consumed). */
  const restartIfPressed = (inputs: PlayerInputs): boolean => {
    const { round: progress, timeSeconds } = round.state;
    const restart = isRestartPress({
      phase: progress.phase,
      secondsSinceEnd: timeSeconds - (progress.endedAt ?? timeSeconds),
      lockSeconds: round.state.tunables.match.restartLockSeconds,
      inputs,
      previous: previousInputs,
    });
    if (!restart) return false;
    clearStage(app);
    round = startRound();
    return true;
  };

  const onFrame = (ticker: Ticker): void => {
    const frameSeconds = ticker.deltaMS / 1000;
    const advance = advanceFixedStep(clock, frameSeconds, {
      stepSeconds,
      maxSteps: tunables.sim.maxStepsPerFrame,
    });
    clock = advance.clock;
    const inputs = input.sample();
    const restarted = restartIfPressed(inputs);
    previousInputs = inputs;
    if (restarted) return;
    for (let i = 0; i < advance.steps; i += 1) stepGame(round.state, inputs, stepSeconds);
    renderGame(round.renderer, { state: round.state, app, dt: frameSeconds });
  };

  app.ticker.add(onFrame);
  return () => {
    input.dispose();
    // usePixiApp's cleanup runs first on unmount and destroys the app (ticker, stage, children);
    // only a still-live app (a session restart on the same app) needs manual teardown.
    if (!isAppAlive(app)) return;
    app.ticker.remove(onFrame);
    clearStage(app);
  };
}

export function useGameSession(app: Application | null, level: LevelDefinition | null): void {
  useEffect(() => {
    if (!app || !level) return undefined;
    let cancelled = false;
    let stop: (() => void) | null = null;
    // Pixi Text rasterises with the face available at creation: wait for Fredoka first.
    void waitForGameFont(FONT_WAIT_MS).then(() => {
      if (!cancelled && isAppAlive(app)) stop = startSession(app, level);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [app, level]);
}
