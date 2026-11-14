import type { GamepadSnapshot, InputSource, PlayerInput } from "@/shared/types/gameInput.types";
import { GAME_KEY_CODES, mapPlayerInputs } from "@/shared/utils/gameInputMapping";

/**
 * Browser input adapter: tracks held keys and samples the Gamepad API once per frame, then
 * hands plain `PlayerInput` values to the simulation (mapping: `gameInputMapping`).
 */
export interface GameInputReader {
  /** Current input for every slot. Call once per rendered frame. */
  sample: () => PlayerInput[];
  /** Removes the listeners. */
  dispose: () => void;
}

const toSnapshot = (pad: Gamepad | null): GamepadSnapshot | null =>
  pad ? { axes: pad.axes, buttons: pad.buttons.map((button) => button.pressed) } : null;

const readGamepads = (): (GamepadSnapshot | null)[] => {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads(), toSnapshot);
};

/** Starts listening on `target` (usually `window`). */
export function createGameInputReader(
  target: Window,
  sources?: readonly InputSource[]
): GameInputReader {
  const heldKeys = new Set<string>();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!GAME_KEY_CODES.has(event.code)) return;
    event.preventDefault();
    heldKeys.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.code);
  };
  // Keys released while the window is unfocused never fire keyup.
  const onBlur = (): void => heldKeys.clear();

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    sample: () => mapPlayerInputs({ heldKeys, gamepads: readGamepads() }, sources),
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      heldKeys.clear();
    },
  };
}
