import { useCallback, useMemo, useRef, useState } from "react";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelLibraryEntry } from "@/features/level-file/api/levelFileApi";
import type { MatchSetup } from "@/features/match/api/matchApi";
import { useAudioEngine, useSoundSettings, withVolumeStep } from "@/features/sound/api/soundApi";
import {
  channelOfVolumeRow,
  createLobbyState,
  reduceLobby,
  selectedLevelId,
} from "@/features/lobby/services/lobbyMenu";
import { slotSources } from "@/features/lobby/services/lobbySlots";
import { lobbyView } from "@/features/lobby/services/lobbyView";
import { applyMatchSettings } from "@/features/lobby/services/matchSettings";
import type {
  LobbyAction,
  LobbyContext,
  LobbyEffect,
  LobbyState,
  LobbyView,
} from "@/features/lobby/types/lobby.types";

export interface Lobby {
  state: LobbyState;
  context: LobbyContext;
  /** The entry a round would play now, or null. */
  selectedLevel: LevelLibraryEntry | null;
  /** Display values for the screen. */
  view: LobbyView;
  /**
   * Runs one action (any input path) and returns the effect the screen must carry out. Volume
   * effects are applied here, to the app's sound settings.
   */
  dispatch: (action: LobbyAction) => LobbyEffect;
  /** What the match needs for a round with the current players, level and settings. */
  matchSetup: () => MatchSetup | null;
}

/**
 * Lobby state that outlives the screen: players, level choice and settings survive a round,
 * so "back to the lobby" keeps them. Held in a ref too, so several presses in one frame
 * reduce in order without waiting for a render.
 */
export function useLobby(levels: readonly LevelLibraryEntry[]): Lobby {
  const [state, setState] = useState(() => createLobbyState(DEFAULT_GAME_TUNABLES));
  const stateRef = useRef(state);
  const context = useMemo<LobbyContext>(
    () => ({ playableLevelIds: levels.filter((e) => e.level).map((e) => e.id) }),
    [levels]
  );
  const contextRef = useRef(context);
  contextRef.current = context;
  const engine = useAudioEngine();
  const sound = useSoundSettings(engine);

  const dispatch = useCallback(
    (action: LobbyAction): LobbyEffect => {
      // The weapons row locks while the chosen level sets its own weapons (weapons-match-setting D6).
      const chosenId = selectedLevelId(stateRef.current, contextRef.current);
      const chosen = levels.find((entry) => entry.id === chosenId)?.level;
      const weaponsSetByLevel = chosen?.settings.weaponIds !== undefined;
      const result = reduceLobby(stateRef.current, action, {
        ...contextRef.current,
        weaponsSetByLevel,
      });
      stateRef.current = result.state;
      setState(result.state);
      const { effect } = result;
      if (effect !== null && typeof effect === "object") {
        const channel = channelOfVolumeRow(effect.row);
        engine.updateSettings((settings) =>
          withVolumeStep(settings, { channel, step: effect.step, wrap: effect.wrap })
        );
      }
      return effect;
    },
    [engine, levels]
  );

  const levelId = selectedLevelId(state, context);
  const selectedLevel = levels.find((entry) => entry.id === levelId) ?? null;

  const matchSetup = useCallback((): MatchSetup | null => {
    const current = stateRef.current;
    const id = selectedLevelId(current, contextRef.current);
    const level = levels.find((entry) => entry.id === id)?.level;
    if (!level) return null;
    return {
      level,
      tunables: applyMatchSettings(DEFAULT_GAME_TUNABLES, current.settings),
      inputSources: slotSources(current.slots),
    };
  }, [levels]);

  const view = lobbyView(state, {
    tunables: DEFAULT_GAME_TUNABLES,
    context,
    level: selectedLevel?.level ?? null,
    sound,
  });

  return { state, context, selectedLevel, view, dispatch, matchSetup };
}
