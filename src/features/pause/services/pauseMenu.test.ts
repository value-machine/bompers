import { describe, expect, it } from "vitest";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { EMPTY_MENU_INPUT, EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import {
  CLOSED_PAUSE_MENU,
  PAUSE_ROWS,
  gateHeldInputs,
  heldGateOf,
  pausePressesOf,
  reducePauseMenu,
} from "@/features/pause/services/pauseMenu";
import type { PauseMenuState, PauseRow } from "@/features/pause/types/pause.types";

const open = (cursor = 0): PauseMenuState => ({ open: true, cursor });
const rowIndex = (row: PauseRow): number => PAUSE_ROWS.indexOf(row);
const input = (over: Partial<PlayerInput>): PlayerInput => ({
  ...EMPTY_PLAYER_INPUT,
  connected: true,
  ...over,
});

describe("reducePauseMenu", () => {
  it("should open on Resume when a player presses pause during play", () => {
    const result = reducePauseMenu(CLOSED_PAUSE_MENU, { type: "press", button: "pause" });
    expect(result.state).toEqual({ open: true, cursor: rowIndex("resume") });
    expect(result.effect).toBeNull();
  });

  it("should ignore menu buttons when the menu is closed", () => {
    for (const button of ["up", "down", "confirm", "back", "left"] as const) {
      expect(reducePauseMenu(CLOSED_PAUSE_MENU, { type: "press", button }).state.open).toBe(false);
    }
  });

  it("should close with a resume effect when pause, back or Resume is pressed", () => {
    for (const button of ["pause", "back"] as const) {
      const result = reducePauseMenu(open(rowIndex("sfx")), { type: "press", button });
      expect(result.state.open).toBe(false);
      expect(result.effect).toEqual({ type: "resume" });
    }
    const confirm = reducePauseMenu(open(), { type: "press", button: "confirm" });
    expect(confirm.state.open).toBe(false);
    expect(confirm.effect).toEqual({ type: "resume" });
  });

  it("should move the shared cursor and wrap when up or down is pressed", () => {
    expect(reducePauseMenu(open(0), { type: "press", button: "up" }).state.cursor).toBe(
      PAUSE_ROWS.length - 1
    );
    expect(reducePauseMenu(open(0), { type: "press", button: "down" }).state.cursor).toBe(1);
  });

  it("should toggle a sound channel when its switch row is confirmed or stepped", () => {
    const music = rowIndex("music");
    expect(reducePauseMenu(open(music), { type: "press", button: "confirm" }).effect).toEqual({
      type: "toggle",
      channel: "music",
    });
    expect(reducePauseMenu(open(rowIndex("sfx")), { type: "press", button: "right" })).toEqual({
      state: open(rowIndex("sfx")),
      effect: { type: "toggle", channel: "sfx" },
    });
  });

  it("should step a volume when its row is confirmed (wrapping) or stepped (clamped)", () => {
    const row = rowIndex("musicVolume");
    expect(reducePauseMenu(open(row), { type: "press", button: "confirm" }).effect).toEqual({
      type: "volume",
      channel: "music",
      step: 1,
      wrap: true,
    });
    expect(reducePauseMenu(open(row), { type: "press", button: "left" }).effect).toEqual({
      type: "volume",
      channel: "music",
      step: -1,
      wrap: false,
    });
  });

  it("should leave for the main menu when the main menu row is confirmed", () => {
    const result = reducePauseMenu(open(rowIndex("mainMenu")), {
      type: "press",
      button: "confirm",
    });
    expect(result.effect).toEqual({ type: "mainMenu" });
  });

  it("should put the cursor on a row and activate it when the pointer clicks it", () => {
    const result = reducePauseMenu(open(0), { type: "activate", row: "sfxVolume" });
    expect(result.state.cursor).toBe(rowIndex("sfxVolume"));
    expect(result.effect).toEqual({ type: "volume", channel: "sfx", step: 1, wrap: true });
  });

  it("should offer no match settings when the menu lists its rows", () => {
    const rows: readonly string[] = PAUSE_ROWS;
    for (const setting of ["duration", "gravity", "level"]) expect(rows).not.toContain(setting);
  });
});

describe("held input gate", () => {
  it("should hide jump and fire when they were held at resume and not yet released", () => {
    const atResume = [input({ jump: true }), input({ fire: true, moveX: 1 })];
    let gate = heldGateOf(atResume);

    const still = gateHeldInputs(gate, atResume);
    expect(still.inputs[0]?.jump).toBe(false);
    expect(still.inputs[1]?.fire).toBe(false);
    expect(still.inputs[1]?.moveX).toBe(1);
    gate = still.gate;

    const released = gateHeldInputs(gate, [input({}), input({ fire: true })]);
    expect(released.inputs[1]?.fire).toBe(false);
    gate = released.gate;

    const pressedAgain = gateHeldInputs(gate, [input({ jump: true }), input({ fire: true })]);
    expect(pressedAgain.inputs[0]?.jump).toBe(true);
    expect(pressedAgain.inputs[1]?.fire).toBe(false);
  });

  it("should pass inputs through unchanged when nothing was held at resume", () => {
    const inputs = [input({ jump: true })];
    const result = gateHeldInputs(heldGateOf([input({})]), inputs);
    expect(result.inputs).toBe(inputs);
  });
});

describe("pausePressesOf", () => {
  it("should report a press when it is new and its device plays the match", () => {
    const held = { ...EMPTY_MENU_INPUT, present: true, down: true, confirm: true };
    const previous = [EMPTY_MENU_INPUT, { ...EMPTY_MENU_INPUT, confirm: true }, EMPTY_MENU_INPUT];
    const presses = pausePressesOf([held, held, held], previous, [true, true, false]);
    expect(presses).toEqual(["down", "confirm", "down"]);
  });
});
