import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { InputSource } from "@/shared/types/gameInput.types";
import type {
  LobbyAction,
  LobbyButton,
  LobbyEffect,
  LobbyState,
} from "@/features/lobby/types/lobby.types";
import {
  canStart,
  createLobbyState,
  LOBBY_ROWS,
  reduceLobby,
  selectedLevelId,
} from "@/features/lobby/services/lobbyMenu";

const LEFT: InputSource = { kind: "keyboard", layout: "left" };
const RIGHT: InputSource = { kind: "keyboard", layout: "right" };
const CONTEXT = { playableLevelIds: ["a", "b"] };

const press = (device: InputSource, button: LobbyButton): LobbyAction => ({
  type: "press",
  device,
  button,
});

/** Applies actions in order; returns the last state and effect. */
const run = (actions: LobbyAction[], start = createLobbyState(DEFAULT_GAME_TUNABLES)) =>
  actions.reduce((result, action) => reduceLobby(result.state, action, CONTEXT), {
    state: start,
    effect: null,
  } as { state: LobbyState; effect: LobbyEffect });

describe("lobbyMenu", () => {
  it("should join a device with confirm and start the match with its next confirm", () => {
    const joined = run([press(LEFT, "confirm")]);
    expect(joined.state.slots[0]).toEqual(LEFT);
    expect(joined.effect).toBeNull();
    expect(run([press(LEFT, "confirm"), press(LEFT, "confirm")]).effect).toBe("start");
  });

  it("should ignore menu buttons from a device that has not joined", () => {
    const start = createLobbyState(DEFAULT_GAME_TUNABLES);
    const { state } = run([press(RIGHT, "up"), press(RIGHT, "back"), press(RIGHT, "right")], start);
    expect(state).toEqual(start);
  });

  it("should free the slot when a joined player presses back", () => {
    const { state } = run([press(LEFT, "confirm"), press(RIGHT, "confirm"), press(LEFT, "back")]);
    expect(state.slots).toEqual([null, RIGHT, null, null]);
  });

  it("should not start when nobody has joined", () => {
    const start = createLobbyState(DEFAULT_GAME_TUNABLES);
    expect(canStart(start, CONTEXT)).toBe(false);
    expect(run([{ type: "activate", row: "start" }]).effect).toBeNull();
  });

  it("should change the focused row's value with left and right when a joined player navigates", () => {
    const toDuration = LOBBY_ROWS.indexOf("start") - LOBBY_ROWS.indexOf("duration");
    const ups = Array.from({ length: toDuration }, () => press(LEFT, "up"));
    const { state } = run([press(LEFT, "confirm"), ...ups, press(LEFT, "right")]);
    expect(LOBBY_ROWS[state.cursor]).toBe("duration");
    expect(state.settings.durationSeconds).toBe(300);
  });

  it("should cycle levels and default to the first playable one when choosing a level", () => {
    const start = createLobbyState(DEFAULT_GAME_TUNABLES);
    expect(selectedLevelId(start, CONTEXT)).toBe("a");
    const { state } = run([{ type: "cycle", row: "level", step: 1 }]);
    expect(selectedLevelId(state, CONTEXT)).toBe("b");
    const gone = { ...state, levelId: "removed" };
    expect(selectedLevelId(gone, CONTEXT)).toBe("a");
  });

  it("should ask the screen to open the file picker when the load-file row is activated", () => {
    expect(run([{ type: "activate", row: "loadFile" }]).effect).toBe("pickFile");
  });

  it("should step the music volume without wrapping when a joined player presses left or right on it", () => {
    const { effect, state } = run([
      press(LEFT, "confirm"),
      press(LEFT, "down"),
      press(LEFT, "left"),
    ]);
    expect(LOBBY_ROWS[state.cursor]).toBe("musicVolume");
    expect(effect).toEqual({ type: "volume", row: "musicVolume", step: -1, wrap: false });
  });

  it("should step the sound volume up with wrap when its row is activated", () => {
    expect(run([{ type: "activate", row: "sfxVolume" }]).effect).toEqual({
      type: "volume",
      row: "sfxVolume",
      step: 1,
      wrap: true,
    });
    expect(run([{ type: "cycle", row: "sfxVolume", step: 1 }]).effect).toEqual({
      type: "volume",
      row: "sfxVolume",
      step: 1,
      wrap: false,
    });
  });
});
