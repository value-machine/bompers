import type {
  GamepadSnapshot,
  InputSource,
  KeyboardLayoutId,
  PlayerInput,
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
}

export const KEYBOARD_LAYOUTS: Record<KeyboardLayoutId, KeyboardLayout> = {
  left: {
    left: ["KeyA"],
    right: ["KeyD"],
    up: ["KeyW"],
    down: ["KeyS"],
    jump: ["KeyW", "Space"],
    fire: ["KeyF"],
  },
  right: {
    left: ["ArrowLeft"],
    right: ["ArrowRight"],
    up: ["ArrowUp"],
    down: ["ArrowDown"],
    jump: ["ArrowUp"],
    fire: ["Slash", "Numpad0", "Enter"],
  },
};

/** Default slot → device map. Joining/reassigning devices is the lobby's job. */
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

export const GAMEPAD_DEADZONE = 0.25;

/** Standard-mapping button indices. */
const PAD_BUTTON = { a: 0, x: 2, rb: 5, rt: 7, dpadLeft: 14, dpadRight: 15 } as const;

export const EMPTY_PLAYER_INPUT: PlayerInput = {
  connected: false,
  moveX: 0,
  aimX: 0,
  aimY: 0,
  jump: false,
  fire: false,
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
  const aimY = axisFrom(anyHeld(held, layout.up), anyHeld(held, layout.down));
  return {
    connected: true,
    moveX,
    aimX: moveX,
    aimY,
    jump: anyHeld(held, layout.jump),
    fire: anyHeld(held, layout.fire),
  };
}

const applyDeadzone = (value: number): number => (Math.abs(value) < GAMEPAD_DEADZONE ? 0 : value);

const pressed = (pad: GamepadSnapshot, index: number): boolean => pad.buttons[index] === true;

const stick = (pad: GamepadSnapshot, xAxis: number) => ({
  x: applyDeadzone(pad.axes[xAxis] ?? 0),
  y: applyDeadzone(pad.axes[xAxis + 1] ?? 0),
});

/** Maps one gamepad snapshot (or its absence) to input. Right stick aims; left stick otherwise. */
export function mapGamepadInput(pad: GamepadSnapshot | null): PlayerInput {
  if (!pad) return EMPTY_PLAYER_INPUT;
  const dpadX = axisFrom(pressed(pad, PAD_BUTTON.dpadLeft), pressed(pad, PAD_BUTTON.dpadRight));
  const move = stick(pad, 0);
  const aim = stick(pad, 2);
  const moveX = dpadX !== 0 ? dpadX : move.x;
  const usesAimStick = aim.x !== 0 || aim.y !== 0;
  const fireButtons = [PAD_BUTTON.rt, PAD_BUTTON.rb, PAD_BUTTON.x];
  return {
    connected: true,
    moveX,
    aimX: usesAimStick ? aim.x : moveX,
    aimY: usesAimStick ? aim.y : move.y,
    jump: pressed(pad, PAD_BUTTON.a),
    fire: fireButtons.some((button) => pressed(pad, button)),
  };
}

export interface RawInputState {
  heldKeys: ReadonlySet<string>;
  /** Snapshots by gamepad index; missing or null = not connected. */
  gamepads: readonly (GamepadSnapshot | null)[];
}

/** Maps raw device state to one `PlayerInput` per slot, in slot order. */
export function mapPlayerInputs(
  raw: RawInputState,
  sources: readonly InputSource[] = DEFAULT_INPUT_SOURCES
): PlayerInput[] {
  return sources.map((source) =>
    source.kind === "keyboard"
      ? mapKeyboardInput(raw.heldKeys, source.layout)
      : mapGamepadInput(raw.gamepads[source.padIndex] ?? null)
  );
}
