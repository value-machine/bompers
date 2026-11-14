import { useEffect } from "react";
import type { Application, Ticker } from "pixi.js";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { advanceFixedStep, createFixedStepClock } from "@/shared/services/gameLoop";
import { createGameInputReader } from "@/shared/services/gameInputService";
import { PLACEHOLDER_LEVEL } from "@/features/arena/api/arenaApi";
import { createGameState, stepGame } from "@/features/match/services/gameSim";
import { createGameRenderer, renderGame } from "@/features/match/services/gameRenderer";

// Pixi nulls these on destroy although the types say they are always set.
const isAppAlive = (app: Application): boolean =>
  (app.ticker as Ticker | null) !== null && (app.stage as Application["stage"] | null) !== null;

/**
 * Runs one match on a ready Pixi app: input → fixed steps of `stepGame` → render, once per
 * Pixi ticker frame. Everything is created in the effect and torn down in its cleanup, so a
 * StrictMode remount starts a clean session.
 */
export function useGameSession(app: Application | null): void {
  useEffect(() => {
    if (!app) return undefined;
    const tunables = DEFAULT_GAME_TUNABLES;
    const stepSeconds = 1 / tunables.sim.stepHz;
    const state = createGameState({ level: PLACEHOLDER_LEVEL, tunables });
    const input = createGameInputReader(window);
    const renderer = createGameRenderer(app, state);
    let clock = createFixedStepClock();

    const onFrame = (ticker: Ticker): void => {
      const frameSeconds = ticker.deltaMS / 1000;
      const advance = advanceFixedStep(clock, frameSeconds, {
        stepSeconds,
        maxSteps: tunables.sim.maxStepsPerFrame,
      });
      clock = advance.clock;
      const inputs = input.sample();
      for (let i = 0; i < advance.steps; i += 1) stepGame(state, inputs, stepSeconds);
      renderGame(renderer, { state, app, dt: frameSeconds });
    };

    app.ticker.add(onFrame);
    return () => {
      input.dispose();
      // usePixiApp's cleanup runs first on unmount and destroys the app (ticker, stage, children);
      // only a still-live app (a session restart on the same app) needs manual teardown.
      if (!isAppAlive(app)) return;
      app.ticker.remove(onFrame);
      app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
    };
  }, [app]);
}
