import type {
  GamepadSnapshot,
  InputSource,
  KeyboardLayoutId,
  MenuInput,
  PlayerInput,
  SlotSources,
} from "@/shared/types/gameInput.types";

/**
 * Pure mapping from raw device state to `PlayerInput`. Keys are `KeyboardEvent.code` values
 * (physical keys), so both halves work on any keyboard layout.
 */
interface KeyboardLayout {
  left: readonly string[];
  right: readonly string[];
  up: readonly string[];
  down: readonly string[];
  jump: readonly string[];
  fire: readonly string[];
  /** Match only: pause / start (both halves share Escape). */
  pause: readonly string[];
  /** Menu only: join / choose / start. */
  confirm: readonly string[];
  /** Menu only: leave / back to the lobby. */
  back: readonly string[];
}

export const KEYBOARD_LAYOUTS: Record<KeyboardLayoutId, KeyboardLayout> = {
  left: {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW"],
    down: ["KeyS"],
    jump: ["KeyW", "Space"],
    fire: ["KeyF"],
    pause: ["Escape"],
    confirm: ["Space", "KeyF"],
    back: ["KeyQ"],
  },
  right: {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    jump: ["ArrowUp"],
    fire: ["Slash", "Numpad0", "Enter"],
    pause: ["Escape"],
    confirm: ["Enter", "Slash", "Numpad0"],
    back: ["Backspace"],
  },
};

/** Every device a player can join with, in lobby order: keyboard halves, then pads 0–3. */
export const INPUT_DEVICES: readonly InputSource[] = [
  { kind: "keyboard", layout: "left" },
  { kind: "keyboard", layout: "right" },
  { kind: "gamepad", padIndex: 0 },
  { kind: "gamepad", padIndex: 1 },
  { kind: "gamepad", padIndex: 2 },
  { kind: "gamepad", padIndex: 3 },
];

/** Stable key of a device (`keyboard:left`, `gamepad:2`), for maps and React keys. */
export const inputSourceKey = (source: InputSource): string =>
  source.kind === "keyboard" ? `keyboard:${source.layout}` : `gamepad:${source.padIndex}`;

/** Default slot → device map (tests, and a match started without the lobby). */
export const DEFAULT_INPUT_SOURCES: readonly InputSource[] = [
  { kind: "keyboard", layout: "left" },
  { kind: "keyboard", layout: "right" },
  { kind: "gamepad", padIndex: 0 },
  { kind: "gamepad", padIndex: 1 },
];

/** Every key code the layouts use (the input service prevents their default scroll). */
export const GAME_KEY_CODES: ReadonlySet<string> = new Set(
  Object.values(KEYBOARD_LAYOUTS).flatMap((layout) => Object.values(layout).flat())
);

/**
 * Stick deadzone (0–1). Move uses it per axis on x, so a stick pushed up does not creep
 * sideways; aim uses it radially, so the aim keeps the stick's true direction. Both rescale
 * the rest of the range to 0–1, so speed ramps from zero just past the deadzone.
 */
export const GAMEPAD_DEADZONE = 0.25;

/** Standard-mapping button indices. */
const PAD_BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  rb: 5,
  rt: 7,
  start: 9,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

/** A stick must pass this far to count as a menu direction (firmer than the play deadzone). */
const MENU_STICK_THRESHOLD = 0.5;

/** The move stick crouches when it points this far down and more down than sideways. */
export const CROUCH_STICK_THRESHOLD = 0.5;

export const EMPTY_PLAYER_INPUT: PlayerInput = {
  connected: false,
  moveX: 0,
  aimX: 0,
  aimY: 0,
  jump: false,
  fire: false,
  pause: false,
  crouch: false,
};

const anyHeld = (held: ReadonlySet<string>, codes: readonly string[]): boolean =>
  codes.some((code) => held.has(code));

const axisFrom = (negative: boolean, positive: boolean): number =>
  (positive ? 1 : 0) - (negative ? 1 : 0);

/** Maps the held keys to one keyboard half's input. */
export function mapKeyboardInput(
  held: ReadonlySet<string>,
  layoutId: KeyboardLayoutId
): PlayerInput {
  const layout = KEYBOARD_LAYOUTS[layoutId];
  const moveX = axisFrom(anyHeld(held, layout.left), anyHeld(held, layout.right));
  const down = anyHeld(held, layout.down);
  const aimY = axisFrom(anyHeld(held, layout.up), down);
  return {
    connected: true,
    moveX,
    aimX: moveX,
    aimY,
    jump: anyHeld(held, layout.jump),
    fire: anyHeld(held, layout.fire),
    pause: anyHeld(held, layout.pause),
    crouch: down,
  };
}

const pressed = (pad: GamepadSnapshot, index: number): boolean => pad.buttons[index] === true;

/** Rescales the part of `magnitude` past the deadzone to 0–1. */
const pastDeadzone = (magnitude: number): number =>
  Math.min(1, Math.max(0, (magnitude - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE)));

/** Axial deadzone on one axis, rescaled. */
const axisPastDeadzone = (value: number): number =>
  Math.sign(value) * pastDeadzone(Math.abs(value));

/** Radial deadzone on one stick (`xAxis`, `xAxis + 1`), rescaled and clamped to the unit circle. */
function stickPastDeadzone(pad: GamepadSnapshot, xAxis: number): { x: number; y: number } {
  const x = pad.axes[xAxis] ?? 0;
  const y = pad.axes[xAxis + 1] ?? 0;
  const magnitude = Math.hypot(x, y);
  const scale = magnitude > 0 ? pastDeadzone(magnitude) / magnitude : 0;
  return { x: x * scale, y: y * scale };
}

/** Maps one gamepad snapshot (or its absence) to input. Right stick aims; left stick otherwise. */
export function mapGamepadInput(pad: GamepadSnapshot | null): PlayerInput {
  if (!pad) return EMPTY_PLAYER_INPUT;
  const dpadX = axisFrom(pressed(pad, PAD_BUTTON.dpadLeft), pressed(pad, PAD_BUTTON.dpadRight));
  const moveX = dpadX !== 0 ? dpadX : axisPastDeadzone(pad.axes[0] ?? 0);
  const move = stickPastDeadzone(pad, 0);
  const aim = stickPastDeadzone(pad, 2);
  const usesAimStick = aim.x !== 0 || aim.y !== 0;
  const fireButtons = [PAD_BUTTON.rt, PAD_BUTTON.rb, PAD_BUTTON.x];
  return {
    connected: true,
    moveX,
    aimX: usesAimStick ? aim.x : moveX,
    aimY: usesAimStick ? aim.y : move.y,
    jump: pressed(pad, PAD_BUTTON.a),
    fire: fireButtons.some((button) => pressed(pad, button)),
    pause: pressed(pad, PAD_BUTTON.start),
    crouch: pressed(pad, PAD_BUTTON.dpadDown) || stickCrouches(move),
  };
}

/** Raw move stick (deadzone applied) points mostly down. */
const stickCrouches = (move: { x: number; y: number }): boolean =>
  move.y >= CROUCH_STICK_THRESHOLD && move.y > Math.abs(move.x);

export interface RawInputState {
  heldKeys: ReadonlySet<string>;
  /** Snapshots by gamepad index; missing or null = not connected. */
  gamepads: readonly (GamepadSnapshot | null)[];
}

/** Maps raw device state to one `PlayerInput` per slot, in slot order (null slot = empty). */
export function mapPlayerInputs(
  raw: RawInputState,
  sources: SlotSources = DEFAULT_INPUT_SOURCES
): PlayerInput[] {
  return sources.map((source) => {
    if (!source) return EMPTY_PLAYER_INPUT;
    return source.kind === "keyboard"
      ? mapKeyboardInput(raw.heldKeys, source.layout)
      : mapGamepadInput(raw.gamepads[source.padIndex] ?? null);
  });
}

export const EMPTY_MENU_INPUT: MenuInput = {
  present: false,
  up: false,
  down: false,
  left: false,
  right: false,
  confirm: false,
  back: false,
};

function mapKeyboardMenu(held: ReadonlySet<string>, layoutId: KeyboardLayoutId): MenuInput {
  const layout = KEYBOARD_LAYOUTS[layoutId];
  return {
    present: true,
    up: anyHeld(held, layout.up),
    down: anyHeld(held, layout.down),
    left: anyHeld(held, layout.left),
    right: anyHeld(held, layout.right),
    confirm: anyHeld(held, layout.confirm),
    back: anyHeld(held, layout.back),
  };
}

/** D-pad or left stick for directions; A / Start confirm, B back. */
function mapGamepadMenu(pad: GamepadSnapshot | null): MenuInput {
  if (!pad) return EMPTY_MENU_INPUT;
  const x = pad.axes[0] ?? 0;
  const y = pad.axes[1] ?? 0;
  return {
    present: true,
    up: pressed(pad, PAD_BUTTON.dpadUp) || y <= -MENU_STICK_THRESHOLD,
    down: pressed(pad, PAD_BUTTON.dpadDown) || y >= MENU_STICK_THRESHOLD,
    left: pressed(pad, PAD_BUTTON.dpadLeft) || x <= -MENU_STICK_THRESHOLD,
    right: pressed(pad, PAD_BUTTON.dpadRight) || x >= MENU_STICK_THRESHOLD,
    confirm: pressed(pad, PAD_BUTTON.a) || pressed(pad, PAD_BUTTON.start),
    back: pressed(pad, PAD_BUTTON.b),
  };
}

/** Maps raw device state to one `MenuInput` per device, in `devices` order. */
export function mapMenuInputs(
  raw: RawInputState,
  devices: readonly InputSource[] = INPUT_DEVICES
): MenuInput[] {
  return devices.map((device) =>
    device.kind === "keyboard"
      ? mapKeyboardMenu(raw.heldKeys, device.layout)
      : mapGamepadMenu(raw.gamepads[device.padIndex] ?? null)
  );
}
