import type {
  GamepadSnapshot,
  MenuInput,
  PlayerInput,
  SlotSources,
} from "@/shared/types/gameInput.types";
import {
  GAME_KEY_CODES,
  INPUT_DEVICES,
  mapMenuInputs,
  mapPlayerInputs,
  type RawInputState,
} from "@/shared/utils/gameInputMapping";

/**
 * Browser input adapter: tracks held keys and samples the Gamepad API once per frame, then
 * hands plain `PlayerInput` values to the simulation (mapping: `gameInputMapping`).
 */
export interface GameInputReader {
  /** Current input for every slot. Call once per rendered frame. */
  sample: () => PlayerInput[];
  /** Menu buttons of every device (`INPUT_DEVICES` order): lobby and round-end screens. */
  sampleMenus: () => MenuInput[];
  /** Removes the listeners. */
  dispose: () => void;
}

const toSnapshot = (pad: Gamepad | null): GamepadSnapshot | null =>
  pad ? { axes: pad.axes, buttons: pad.buttons.map((button) => button.pressed) } : null;

const readGamepads = (): (GamepadSnapshot | null)[] => {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads(), toSnapshot);
};

/** Starts listening on `target` (usually `window`); `sources` maps devices to slots. */
export function createGameInputReader(target: Window, sources?: SlotSources): GameInputReader {
  const heldKeys = new Set<string>();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!GAME_KEY_CODES.has(event.code)) return;
    event.preventDefault();
    // A key already held when this reader started (e.g. the press that opened the screen)
    // only auto-repeats; it counts once it is pressed again.
    if (event.repeat) return;
    heldKeys.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.code);
  };
  // Keys released while the window is unfocused never fire keyup.
  const onBlur = (): void => heldKeys.clear();

  const raw = (): RawInputState => ({ heldKeys, gamepads: readGamepads() });

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    sample: () => mapPlayerInputs(raw(), sources),
    sampleMenus: () => mapMenuInputs(raw(), INPUT_DEVICES),
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      heldKeys.clear();
    },
  };
}
