import type { SoundChannel } from "@/features/sound/api/soundApi";
import type { MenuInput, PlayerInput, PlayerInputs } from "@/shared/types/gameInput.types";
import type {
  PauseAction,
  PauseButton,
  PauseMenuState,
  PauseRow,
} from "@/features/pause/types/pause.types";

/** What the screen must do after an action (side effects stay out of the reducer). */
export type PauseEffect =
  | { type: "resume" }
  | { type: "mainMenu" }
  | { type: "toggle"; channel: SoundChannel }
  | { type: "volume"; channel: SoundChannel; step: 1 | -1; wrap: boolean }
  | null;

export interface PauseResult {
  state: PauseMenuState;
  effect: PauseEffect;
}

/**
 * The in-match pause menu, top to bottom: player preferences only. Match settings stay in the
 * lobby (FEEDBACK_ROUND_2 § 2.2); "mainMenu" returns to the lobby.
 */
export const PAUSE_ROWS: readonly PauseRow[] = [
  "resume",
  "music",
  "sfx",
  "musicVolume",
  "sfxVolume",
  "mainMenu",
];

export const CLOSED_PAUSE_MENU: PauseMenuState = { open: false, cursor: 0 };

const SWITCH_CHANNEL: Partial<Record<PauseRow, SoundChannel>> = { music: "music", sfx: "sfx" };
const VOLUME_CHANNEL: Partial<Record<PauseRow, SoundChannel>> = {
  musicVolume: "music",
  sfxVolume: "sfx",
};

const close = (state: PauseMenuState): PauseResult => ({
  state: { ...state, open: false },
  effect: { type: "resume" },
});

/** Left / right on a row; `confirm` steps up and wraps a volume. */
function stepRow(row: PauseRow, step: 1 | -1, wrap: boolean): PauseEffect {
  const toggled = SWITCH_CHANNEL[row];
  if (toggled) return { type: "toggle", channel: toggled };
  const volume = VOLUME_CHANNEL[row];
  return volume ? { type: "volume", channel: volume, step, wrap } : null;
}

function activateRow(state: PauseMenuState, row: PauseRow): PauseResult {
  if (row === "resume") return close(state);
  if (row === "mainMenu") return { state, effect: { type: "mainMenu" } };
  return { state, effect: stepRow(row, 1, true) };
}

const STEP_OF: Partial<Record<PauseButton, 1 | -1>> = { up: -1, down: 1, left: -1, right: 1 };

function press(state: PauseMenuState, button: PauseButton): PauseResult {
  if (!state.open) {
    return button === "pause"
      ? { state: { open: true, cursor: 0 }, effect: null }
      : { state, effect: null };
  }
  const row = PAUSE_ROWS[state.cursor] ?? "resume";
  if (button === "pause" || button === "back") return close(state);
  if (button === "confirm") return activateRow(state, row);
  const step = STEP_OF[button] ?? 1;
  if (button === "up" || button === "down") {
    const cursor = (state.cursor + step + PAUSE_ROWS.length) % PAUSE_ROWS.length;
    return { state: { ...state, cursor }, effect: null };
  }
  return { state, effect: stepRow(row, step, false) };
}

/** The pause menu's state machine: pure, so pads, keys and the pointer share it. */
export function reducePauseMenu(state: PauseMenuState, action: PauseAction): PauseResult {
  switch (action.type) {
    case "press":
      return press(state, action.button);
    case "activate":
      return activateRow({ ...state, cursor: PAUSE_ROWS.indexOf(action.row) }, action.row);
    case "cycle":
      return state.open
        ? { state, effect: stepRow(action.row, action.step, false) }
        : { state, effect: null };
  }
}

/** Per slot: jump / fire held when the menu closed, hidden from the sim until released. */
export type HeldGate = readonly { jump: boolean; fire: boolean }[];

/** The gate for the inputs held on the frame the menu closes. */
export const heldGateOf = (inputs: PlayerInputs): HeldGate =>
  inputs.map((input) => ({ jump: input.jump, fire: input.fire }));

const gateOne = (input: PlayerInput, held: HeldGate[number] | undefined): PlayerInput =>
  held && (held.jump || held.fire)
    ? { ...input, jump: input.jump && !held.jump, fire: input.fire && !held.fire }
    : input;

/**
 * The inputs the sim sees after a resume: the press that closed the menu (Space confirms and
 * jumps) must not jump or shoot. A button stays hidden until its slot releases it once.
 */
export function gateHeldInputs(
  gate: HeldGate,
  inputs: PlayerInputs
): { inputs: PlayerInputs; gate: HeldGate } {
  if (!gate.some((held) => held.jump || held.fire)) return { inputs, gate };
  const next = gate.map((held, slot) => ({
    jump: held.jump && inputs[slot]?.jump === true,
    fire: held.fire && inputs[slot]?.fire === true,
  }));
  return { inputs: inputs.map((input, slot) => gateOne(input, gate[slot])), gate: next };
}

const MENU_BUTTONS = ["up", "down", "left", "right", "confirm", "back"] as const;

/**
 * This frame's new menu presses (held now, not in `previous`) of the devices playing the match,
 * in device order. `playing[i]` says whether device i (`INPUT_DEVICES` order) has a slot.
 */
export function pausePressesOf(
  menus: readonly MenuInput[],
  previous: readonly MenuInput[],
  playing: readonly boolean[]
): PauseButton[] {
  const presses: PauseButton[] = [];
  menus.forEach((menu, device) => {
    if (playing[device] !== true) return;
    const before = previous[device];
    for (const button of MENU_BUTTONS) {
      if (menu[button] && before?.[button] !== true) presses.push(button);
    }
  });
  return presses;
}
