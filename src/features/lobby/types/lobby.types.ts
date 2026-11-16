import type { InputSource } from "@/shared/types/gameInput.types";

/** Match settings the players choose (GDD § 7). Gravity is a multiplier of the engine default. */
export interface MatchSettings {
  durationSeconds: number;
  gravityScale: number;
}

/** Player slots 0–3: the device that claimed each slot, or null when free. */
export type LobbySlots = readonly (InputSource | null)[];

/** The lobby menu, top to bottom. */
export type LobbyRow = "level" | "loadFile" | "duration" | "gravity" | "start" | VolumeRow;

export interface LobbyState {
  slots: LobbySlots;
  /** Index into `LOBBY_ROWS` of the row the shared menu cursor is on. */
  cursor: number;
  /** Chosen level library id; null = the first playable level. */
  levelId: string | null;
  settings: MatchSettings;
}

/** A menu button of one device (see `MenuInput`). */
export type LobbyButton = "up" | "down" | "left" | "right" | "confirm" | "back";

export type LobbyAction =
  /** A device pressed a menu button (keyboard half or gamepad). */
  | { type: "press"; device: InputSource; button: LobbyButton }
  /** Pointer: put the cursor on a row and activate it (like confirm by a joined player). */
  | { type: "activate"; row: LobbyRow }
  /** Pointer: step a value row. */
  | { type: "cycle"; row: LobbyRow; step: 1 | -1 }
  | { type: "selectLevel"; levelId: string }
  /** Pointer: free a slot. */
  | { type: "leave"; slot: number };

/** The menu rows that set a volume. */
export type VolumeRow = "musicVolume" | "sfxVolume";

/** Step a volume row (the setting lives in the sound feature, not the lobby; see `channelOfVolumeRow`). */
export interface VolumeEffect {
  type: "volume";
  row: VolumeRow;
  step: 1 | -1;
  /** Confirm steps up and wraps from full to 0; left / right stop at the ends. */
  wrap: boolean;
}

/** What the screen must do after an action (side effects stay out of the reducer). */
export type LobbyEffect = "start" | "pickFile" | VolumeEffect | null;

export interface LobbyContext {
  /** Ids of the levels that can be played now, in picker order. */
  playableLevelIds: readonly string[];
}

export interface SlotView {
  slot: number;
  /** Index into `INPUT_DEVICES` of the device in this slot, or -1 when free. */
  deviceIndex: number;
  deviceLabel: string | null;
  leaveKey: string | null;
}

export interface DeviceView {
  key: string;
  label: string;
  /** Slot the device holds, or -1. */
  slot: number;
}

/** Everything the lobby screen shows, as display values (components stay free of rules). */
export interface LobbyView {
  players: number;
  startable: boolean;
  focusedRow: LobbyRow;
  slots: SlotView[];
  devices: DeviceView[];
  duration: string;
  gravity: string;
  /** "1:30" when the level's own match length overrides the lobby's, else null. */
  levelDuration: string | null;
  /** "0.8× = 1.2×" style note when the level scales gravity, else null. */
  levelGravity: string | null;
  /** Volumes as "0"–"10". */
  musicVolume: string;
  sfxVolume: string;
}
