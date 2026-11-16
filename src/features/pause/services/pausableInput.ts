import type { MenuInput, PlayerInputs, SlotSources } from "@/shared/types/gameInput.types";
import { INPUT_DEVICES, inputSourceKey } from "@/shared/utils/gameInputMapping";
import type { PauseLink } from "@/features/pause/types/pause.types";
import {
  gateHeldInputs,
  heldGateOf,
  pausePressesOf,
  type HeldGate,
} from "@/features/pause/services/pauseMenu";

/** The two reads a match does per frame (see `createGameInputReader`). */
export interface FrameInputReader {
  sample: () => PlayerInputs;
  sampleMenus: () => MenuInput[];
}

/** One frame's input for the match: the sim's inputs, a back press, and a just-ended pause. */
export interface UnpausedFrame {
  inputs: PlayerInputs;
  /** Any device newly pressed back (round-end: to the lobby). */
  back: boolean;
  /** First frame after the menu closed: the caller restarts its step clock. */
  resumed: boolean;
}

/** Which of `INPUT_DEVICES` play this match (only they drive the pause menu). */
const playingDevices = (sources: SlotSources): boolean[] => {
  const keys = new Set(sources.flatMap((source) => (source ? [inputSourceKey(source)] : [])));
  return INPUT_DEVICES.map((device) => keys.has(inputSourceKey(device)));
};

const backPressed = (menus: readonly MenuInput[], previous: readonly MenuInput[]): boolean =>
  menus.some((menu, index) => menu.back && previous[index]?.back !== true);

/**
 * Reads each frame's match input through the pause menu (pause D1, D2, D6): a pause press of
 * any player opens or closes it, the players' other menu presses go to it while it is open.
 * Returns null while the match holds (the frame that closes the menu included, so its press
 * does nothing else); afterwards jump / fire held at resume stay hidden until released.
 */
export function createPausableInput(
  input: FrameInputReader,
  { pause, sources }: { pause: PauseLink; sources: SlotSources }
): () => UnpausedFrame | null {
  const playing = playingDevices(sources);
  let previousMenus = input.sampleMenus();
  let previousPause: readonly boolean[] = [];
  let wasOpen = false;
  let gate: HeldGate = [];
  /** Forwards this frame's presses; true while the match holds. */
  const holds = (inputs: PlayerInputs, menus: readonly MenuInput[]): boolean => {
    const openBefore = pause.isOpen();
    const pausePressed = inputs.some((one, slot) => one.pause && previousPause[slot] !== true);
    previousPause = inputs.map((one) => one.pause);
    if (pausePressed) pause.press("pause");
    else if (openBefore) pausePressesOf(menus, previousMenus, playing).forEach(pause.press);
    return openBefore || pause.isOpen();
  };
  return () => {
    const inputs = input.sample();
    const menus = input.sampleMenus();
    const back = backPressed(menus, previousMenus);
    const held = holds(inputs, menus);
    previousMenus = menus;
    if (held) {
      wasOpen = true;
      return null;
    }
    const resumed = wasOpen;
    wasOpen = false;
    if (resumed) gate = heldGateOf(inputs);
    const gated = gateHeldInputs(gate, inputs);
    gate = gated.gate;
    return { inputs: gated.inputs, back, resumed };
  };
}
