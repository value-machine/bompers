import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { SoundChannel } from "@/features/sound/api/soundApi";
import type {
  LobbyAction,
  LobbyButton,
  LobbyContext,
  LobbyEffect,
  LobbyRow,
  LobbyState,
  VolumeRow,
} from "@/features/lobby/types/lobby.types";
import type { InputSource } from "@/shared/types/gameInput.types";
import {
  claimSlot,
  createLobbySlots,
  joinedCount,
  leaveSlot,
  slotOfDevice,
} from "@/features/lobby/services/lobbySlots";
import {
  cycleOption,
  defaultMatchSettings,
  DURATION_OPTIONS,
  GRAVITY_OPTIONS,
} from "@/features/lobby/services/matchSettings";

/**
 * Menu rows top to bottom; the cursor starts on Start so joined players can go at once. The
 * volume rows sit below Start: they are player preferences, not match settings.
 */
export const LOBBY_ROWS: readonly LobbyRow[] = [
  "level",
  "loadFile",
  "duration",
  "gravity",
  "start",
  "musicVolume",
  "sfxVolume",
];

/** The sound channel each volume row steps. */
const CHANNEL_OF_VOLUME_ROW: Record<VolumeRow, SoundChannel> = {
  musicVolume: "music",
  sfxVolume: "sfx",
};

export const channelOfVolumeRow = (row: VolumeRow): SoundChannel => CHANNEL_OF_VOLUME_ROW[row];

const isVolumeRow = (row: LobbyRow): row is VolumeRow => row in CHANNEL_OF_VOLUME_ROW;

/** A volume row's effect, or null for any other row. */
function volumeEffect(row: LobbyRow, step: 1 | -1, wrap: boolean): LobbyEffect {
  return isVolumeRow(row) ? { type: "volume", row, step, wrap } : null;
}

const START_ROW = LOBBY_ROWS.indexOf("start");

export const createLobbyState = (tunables: GameTunables): LobbyState => ({
  slots: createLobbySlots(tunables.match.maxPlayers),
  cursor: START_ROW,
  levelId: null,
  settings: defaultMatchSettings(tunables),
});

export interface LobbyResult {
  state: LobbyState;
  effect: LobbyEffect;
}

/** The level a round would play: the chosen one while it is playable, else the first. */
export function selectedLevelId(state: LobbyState, context: LobbyContext): string | null {
  const ids = context.playableLevelIds;
  if (state.levelId !== null && ids.includes(state.levelId)) return state.levelId;
  return ids[0] ?? null;
}

/** At least one player (1 = test mode, GDD § 1) and a playable level. */
export const canStart = (state: LobbyState, context: LobbyContext): boolean =>
  joinedCount(state.slots) > 0 && selectedLevelId(state, context) !== null;

const none = (state: LobbyState): LobbyResult => ({ state, effect: null });

interface CycleArgs {
  row: LobbyRow | undefined;
  step: 1 | -1;
  context: LobbyContext;
}

function cycleRow(state: LobbyState, { row, step, context }: CycleArgs): LobbyState {
  const { settings } = state;
  switch (row) {
    case "duration":
      return {
        ...state,
        settings: {
          ...settings,
          durationSeconds: cycleOption(DURATION_OPTIONS, settings.durationSeconds, step),
        },
      };
    case "gravity":
      return {
        ...state,
        settings: {
          ...settings,
          gravityScale: cycleOption(GRAVITY_OPTIONS, settings.gravityScale, step),
        },
      };
    case "level": {
      const ids = context.playableLevelIds;
      if (ids.length === 0) return state;
      const index = ids.indexOf(selectedLevelId(state, context) ?? "");
      const next = ids[(index + step + ids.length) % ids.length] ?? null;
      return { ...state, levelId: next };
    }
    default:
      return state;
  }
}

function activateRow(state: LobbyState, row: LobbyRow, context: LobbyContext): LobbyResult {
  if (row === "start") return { state, effect: canStart(state, context) ? "start" : null };
  if (row === "loadFile") return { state, effect: "pickFile" };
  const volume = volumeEffect(row, 1, true);
  if (volume) return { state, effect: volume };
  return none(cycleRow(state, { row, step: 1, context }));
}

/** Left / right (keys, pads or the pointer's steppers) on a row. */
function stepRow(state: LobbyState, args: CycleArgs): LobbyResult {
  const volume = args.row ? volumeEffect(args.row, args.step, false) : null;
  return volume ? { state, effect: volume } : none(cycleRow(state, args));
}

const moveCursor = (state: LobbyState, step: 1 | -1): LobbyState => ({
  ...state,
  cursor: (state.cursor + step + LOBBY_ROWS.length) % LOBBY_ROWS.length,
});

const STEP_OF: Partial<Record<LobbyButton, 1 | -1>> = { up: -1, down: 1, left: -1, right: 1 };

/**
 * A device's button press. A device without a slot joins with confirm (and does nothing
 * else); a joined device drives the shared menu: up / down move the cursor, left / right
 * change the row's value, confirm activates the row, back leaves the slot.
 */
function press(
  state: LobbyState,
  { device, button }: { device: InputSource; button: LobbyButton },
  context: LobbyContext
): LobbyResult {
  const slot = slotOfDevice(state.slots, device);
  if (slot === -1) {
    return button === "confirm"
      ? none({ ...state, slots: claimSlot(state.slots, device) })
      : none(state);
  }
  const row = LOBBY_ROWS[state.cursor] ?? "start";
  const step = STEP_OF[button];
  if (button === "back") return none({ ...state, slots: leaveSlot(state.slots, slot) });
  if (button === "confirm") return activateRow(state, row, context);
  if (step === undefined) return none(state);
  if (button === "up" || button === "down") return none(moveCursor(state, step));
  return stepRow(state, { row, step, context });
}

/** The lobby's state machine: pure, so every input path (keys, pads, pointer) shares it. */
export function reduceLobby(
  state: LobbyState,
  action: LobbyAction,
  context: LobbyContext
): LobbyResult {
  switch (action.type) {
    case "press":
      return press(state, action, context);
    case "activate":
      return activateRow(
        { ...state, cursor: Math.max(0, LOBBY_ROWS.indexOf(action.row)) },
        action.row,
        context
      );
    case "cycle":
      return stepRow(state, { row: action.row, step: action.step, context });
    case "selectLevel":
      return none({ ...state, levelId: action.levelId });
    case "leave":
      return none({ ...state, slots: leaveSlot(state.slots, action.slot) });
  }
}
