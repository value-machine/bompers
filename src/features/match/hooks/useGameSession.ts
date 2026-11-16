import { useEffect, useRef } from "react";
import type { Application, Ticker } from "pixi.js";
import { waitForGameFont } from "@/shared/utils/gameFont";
import { advanceFixedStep, createFixedStepClock } from "@/shared/services/gameLoop";
import { createGameInputReader } from "@/shared/services/gameInputService";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import type { MenuInput, PlayerInputs, SlotSources } from "@/shared/types/gameInput.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { createGameState, stepGame, type GameState } from "@/features/match/services/gameSim";
import {
  createGameRenderer,
  renderGame,
  type GameRenderer,
} from "@/features/match/services/gameRenderer";
import { isPastRestartLock, isRestartPress } from "@/features/match/services/matchRules";
import { useAudioEngine, type AudioEngine } from "@/features/sound/api/soundApi";
import { createMatchSound } from "@/features/match/services/matchSound";

// Pixi nulls these on destroy although the types say they are always set.
const isAppAlive = (app: Application): boolean =>
  (app.ticker as Ticker | null) !== null && (app.stage as Application["stage"] | null) !== null;

/** Everything a match needs from the lobby: level, settings and who plays which slot. */
export interface MatchSetup {
  level: LevelDefinition;
  /** Engine tunables with the lobby's settings applied; the level's settings go on top. */
  tunables: GameTunables;
  /** Slot → device; null slots stay empty. */
  inputSources: SlotSources;
}

const clearStage = (app: Application): void => {
  app.stage.removeChildren().forEach((child) => child.destroy({ children: true }));
};

/** Where the round stands for the rematch / lobby choice. */
const roundLockOf = (state: GameState) => {
  const { round, timeSeconds } = state;
  return {
    phase: round.phase,
    secondsSinceEnd: timeSeconds - (round.endedAt ?? timeSeconds),
    lockSeconds: state.tunables.match.restartLockSeconds,
  };
};

/** Level authors (often AI agents) see what was corrected; the game still runs. */
const warnAboutLevel = ({ levelWarnings }: GameState): void => {
  if (levelWarnings.length > 0) console.warn("Level warnings:", levelWarnings);
};

/** True when any device newly pressed back this frame. */
const backPressed = (menus: readonly MenuInput[], previous: readonly MenuInput[]): boolean =>
  menus.some((menu, index) => menu.back && previous[index]?.back !== true);

/** How long a session waits for Fredoka before it starts with the fallback face (visual-pass D5). */
const FONT_WAIT_MS = 1500;

/** Starts matches of `setup` on a live app; returns the teardown. */
interface SessionDeps {
  app: Application;
  engine: AudioEngine;
  exitRef: { current: () => void };
}

function startSession({ app, engine, exitRef }: SessionDeps, setup: MatchSetup): () => void {
  const { level, tunables, inputSources } = setup;
  const stepSeconds = 1 / tunables.sim.stepHz;
  const sound = createMatchSound(engine);
  /** A fresh round on the same level and settings; its first frame cues the round start. */
  const startRound = (): { state: GameState; renderer: GameRenderer } => {
    const state = createGameState({ level, tunables });
    warnAboutLevel(state);
    sound.newRound();
    return { state, renderer: createGameRenderer(app, state) };
  };
  let round = startRound();
  const input = createGameInputReader(window, inputSources);
  let clock = createFixedStepClock();
  let previousInputs: PlayerInputs = [];
  let previousMenus: MenuInput[] = input.sampleMenus();

  /** True when this frame's back press (round over, past the lock) left for the lobby. */
  const exitIfPressed = (): boolean => {
    const menus = input.sampleMenus();
    const pressed = backPressed(menus, previousMenus);
    previousMenus = menus;
    if (!pressed || !isPastRestartLock(roundLockOf(round.state))) return false;
    exitRef.current();
    return true;
  };

  /** True when this frame's jump press restarted the round (that press is then consumed). */
  const restartIfPressed = (inputs: PlayerInputs): boolean => {
    const restart = isRestartPress({
      ...roundLockOf(round.state),
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
    if (exitIfPressed()) return;
    const inputs = input.sample();
    const restarted = restartIfPressed(inputs);
    previousInputs = inputs;
    if (restarted) return;
    for (let i = 0; i < advance.steps; i += 1) stepGame(round.state, inputs, stepSeconds);
    sound.hear(round.state);
    renderGame(round.renderer, { state: round.state, app, dt: frameSeconds });
  };

  app.ticker.add(onFrame);
  return () => {
    input.dispose();
    sound.dispose();
    // usePixiApp's cleanup runs first on unmount and destroys the app (ticker, stage, children);
    // only a still-live app (a session restart on the same app) needs manual teardown.
    if (!isAppAlive(app)) return;
    app.ticker.remove(onFrame);
    clearStage(app);
  };
}

/**
 * Runs matches of `setup` on a ready Pixi app (nothing until it is ready; a new setup object
 * restarts the match): input → fixed steps of `stepGame` → render, once per Pixi ticker
 * frame. After a round ends (past the restart lock), a jump press starts a fresh round on the
 * same level and settings, and a back press calls `onExitToLobby`. Everything is created in
 * the effect and torn down in its cleanup, so a StrictMode remount starts a clean session.
 */
export function useGameSession(
  app: Application | null,
  setup: MatchSetup,
  onExitToLobby: () => void
): void {
  const exitRef = useRef(onExitToLobby);
  exitRef.current = onExitToLobby;
  const engine = useAudioEngine();

  useEffect(() => {
    if (!app) return undefined;
    let cancelled = false;
    let stop: (() => void) | null = null;
    // Pixi Text rasterises with the face available at creation: wait for Fredoka first.
    void waitForGameFont(FONT_WAIT_MS).then(() => {
      if (!cancelled && isAppAlive(app)) stop = startSession({ app, engine, exitRef }, setup);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [app, engine, setup]);
}
