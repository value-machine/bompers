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

// Some browsers keep an unplugged pad in the list with `connected: false` instead of null.
const toSnapshot = (pad: Gamepad | null): GamepadSnapshot | null =>
  pad?.connected ? { axes: pad.axes, buttons: pad.buttons.map((button) => button.pressed) } : null;

const readGamepads = (): (GamepadSnapshot | null)[] => {
  if (typeof navigator === "undefined" || typeof navigator.getGamepads !== "function") return [];
  return Array.from(navigator.getGamepads(), toSnapshot);
};

/** Starts listening on `target` (usually `window`); `sources` maps devices to slots. */
export function createGameInputReader(target: Window, sources?: SlotSources): GameInputReader {
  const heldKeys = new Set<string>();
  // Keys pressed since each read (dash-feel lap): a tap that goes down and up between two frames
  // still counts as held for one read instead of vanishing.
  const tappedForPlay = new Set<string>();
  const tappedForMenus = new Set<string>();

  const onKeyDown = (event: KeyboardEvent): void => {
    if (!GAME_KEY_CODES.has(event.code)) return;
    event.preventDefault();
    // A key already held when this reader started (e.g. the press that opened the screen)
    // only auto-repeats; it counts once it is pressed again.
    if (event.repeat) return;
    heldKeys.add(event.code);
    tappedForPlay.add(event.code);
    tappedForMenus.add(event.code);
  };
  const onKeyUp = (event: KeyboardEvent): void => {
    heldKeys.delete(event.code);
  };
  // Keys released while the window is unfocused never fire keyup.
  const onBlur = (): void => {
    heldKeys.clear();
    tappedForPlay.clear();
    tappedForMenus.clear();
  };

  /** Held keys plus the ones tapped since this read's last call, which it then forgets. */
  const raw = (tapped: Set<string>): RawInputState => {
    const keys = new Set([...heldKeys, ...tapped]);
    tapped.clear();
    return { heldKeys: keys, gamepads: readGamepads() };
  };

  target.addEventListener("keydown", onKeyDown);
  target.addEventListener("keyup", onKeyUp);
  target.addEventListener("blur", onBlur);

  return {
    sample: () => mapPlayerInputs(raw(tappedForPlay), sources),
    sampleMenus: () => mapMenuInputs(raw(tappedForMenus), INPUT_DEVICES),
    dispose: () => {
      target.removeEventListener("keydown", onKeyDown);
      target.removeEventListener("keyup", onKeyUp);
      target.removeEventListener("blur", onBlur);
      onBlur();
    },
  };
}
