/** How often the pads are read while the sound is locked (ms). */
export const GAMEPAD_UNLOCK_POLL_MS = 100;
/** How long a resume gets to start the context before the player is asked for a key or tap (ms). */
export const GAMEPAD_UNLOCK_GRACE_MS = 400;

/** The part of an AudioContext the unlock needs (a real one, or a stub in tests). */
export interface UnlockableContext {
  readonly state: AudioContextState;
  resume(): Promise<void>;
  addEventListener(type: "statechange", listener: () => void): void;
  removeEventListener(type: "statechange", listener: () => void): void;
}

export interface GamepadAudioUnlock {
  /** True after a gamepad press could not start the sound: a key or tap is needed. */
  needsGesture(): boolean;
  /** Called when `needsGesture` changes; returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const anyButtonPressed = (pads: readonly (Gamepad | null)[]): boolean =>
  pads.some((pad) => pad?.connected === true && pad.buttons.some((button) => button.pressed));

/**
 * Browsers start audio suspended and count only keyboard, mouse, pointer and touch input as the
 * gesture that may start it; a gamepad button is not one (w3c/gamepad#4). While the context is
 * suspended this reads the pads, tries `resume()` on each new press (it works where the page
 * already had a gesture or the browser allows autoplay), and reports when a key or tap is still
 * needed. Nothing is read while the sound runs.
 */
export function watchGamepadAudioUnlock(options: {
  getGamepads: (() => readonly (Gamepad | null)[]) | undefined;
  context: UnlockableContext;
}): GamepadAudioUnlock {
  const { getGamepads, context } = options;
  const listeners = new Set<() => void>();
  let needsGesture = false;
  let wasPressed = false;
  let poll: ReturnType<typeof setInterval> | null = null;
  let grace: ReturnType<typeof setTimeout> | null = null;

  const setNeedsGesture = (value: boolean): void => {
    if (needsGesture === value) return;
    needsGesture = value;
    listeners.forEach((listener) => listener());
  };
  const checkAfterResume = (): void => {
    grace = null;
    if (context.state === "suspended") setNeedsGesture(true);
  };
  const readPads = (): void => {
    const pressed = anyButtonPressed(getGamepads?.() ?? []);
    if (pressed && !wasPressed && context.state === "suspended") {
      void context.resume();
      grace ??= setTimeout(checkAfterResume, GAMEPAD_UNLOCK_GRACE_MS);
    }
    wasPressed = pressed;
  };
  const stopPolling = (): void => {
    if (poll !== null) clearInterval(poll);
    if (grace !== null) clearTimeout(grace);
    poll = null;
    grace = null;
  };
  const onStateChange = (): void => {
    if (context.state === "running") {
      stopPolling();
      setNeedsGesture(false);
    } else if (context.state === "suspended" && poll === null && getGamepads) {
      poll = setInterval(readPads, GAMEPAD_UNLOCK_POLL_MS);
    } else if (context.state === "closed") {
      stopPolling();
    }
  };

  context.addEventListener("statechange", onStateChange);
  onStateChange();

  return {
    needsGesture: () => needsGesture,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose: () => {
      stopPolling();
      context.removeEventListener("statechange", onStateChange);
      listeners.clear();
    },
  };
}
