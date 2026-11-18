import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  isChannelEnabled,
  useAudioEngine,
  useSoundSettings,
  withChannelEnabled,
  withVolumeStep,
  type AudioEngine,
  type SoundSettings,
} from "@/features/sound/api/soundApi";
import { getMenuFocusModality } from "@/shared/services/menuFocusModality";
import {
  CLOSED_PAUSE_MENU,
  PAUSE_ROWS,
  reducePauseMenu,
  type PauseEffect,
} from "@/features/pause/services/pauseMenu";
import type {
  PauseAction,
  PauseLink,
  PauseMenuState,
  PauseRow,
} from "@/features/pause/types/pause.types";

export interface PauseMenuControl {
  menu: PauseMenuState;
  /** The row under the shared cursor. */
  focusedRow: PauseRow;
  sound: SoundSettings;
  /** Stable for the component's lifetime (the session holds it). */
  link: PauseLink;
  dispatch: (action: PauseAction) => void;
}

function applySoundEffect(engine: AudioEngine, effect: PauseEffect): void {
  if (effect?.type === "toggle") {
    const { channel } = effect;
    engine.updateSettings((s) => withChannelEnabled(s, channel, !isChannelEnabled(s, channel)));
  } else if (effect?.type === "volume") {
    const { channel, step, wrap } = effect;
    engine.updateSettings((s) => withVolumeStep(s, { channel, step, wrap }));
  }
}

/**
 * The pause menu's state for one match screen. The ref is the source of truth so the session's
 * frame sees an open / close at once; React state mirrors it for the overlay. Sound rows write
 * the app audio engine (the same settings the lobby shows); Main menu calls `onMainMenu`.
 */
export function usePauseMenu(onMainMenu: () => void): PauseMenuControl {
  const engine = useAudioEngine();
  const sound = useSoundSettings(engine);
  const stateRef = useRef<PauseMenuState>(CLOSED_PAUSE_MENU);
  const [menu, setMenu] = useState<PauseMenuState>(CLOSED_PAUSE_MENU);
  const mainMenuRef = useRef(onMainMenu);
  mainMenuRef.current = onMainMenu;

  const dispatch = useCallback(
    (action: PauseAction): void => {
      // Key and pad presses show the focus mark; pointer use hides it (controller-focus D2).
      if (action.type === "press") getMenuFocusModality().noteMenuPress();
      const { state, effect } = reducePauseMenu(stateRef.current, action);
      stateRef.current = state;
      setMenu(state);
      if (effect?.type === "mainMenu") mainMenuRef.current();
      else applySoundEffect(engine, effect);
    },
    [engine]
  );

  // The music pauses with the game and continues in sync (pause D2): leaving for the lobby
  // switches tracks, which ends the hold, so unmount needs no cleanup.
  useEffect(() => engine.setMusicPaused(menu.open), [engine, menu.open]);

  const link = useMemo<PauseLink>(
    () => ({
      isOpen: () => stateRef.current.open,
      press: (button) => dispatch({ type: "press", button }),
    }),
    [dispatch]
  );

  const focusedRow = PAUSE_ROWS[menu.cursor] ?? "resume";
  return { menu, focusedRow, sound, link, dispatch };
}
