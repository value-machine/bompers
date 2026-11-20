import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  GAMEPAD_UNLOCK_GRACE_MS,
  GAMEPAD_UNLOCK_POLL_MS,
  watchGamepadAudioUnlock,
  type UnlockableContext,
} from "@/features/sound/services/gamepadAudioUnlock";

/** A context stub: `resume()` starts it only when the test allows it (the browser's choice). */
function fakeContext(resumeAllowed: boolean) {
  const listeners = new Set<() => void>();
  const context = {
    state: "suspended" as AudioContextState,
    resume: vi.fn(() => {
      if (resumeAllowed) setState("running");
      return Promise.resolve();
    }),
    addEventListener: (_type: "statechange", listener: () => void) => listeners.add(listener),
    removeEventListener: (_type: "statechange", listener: () => void) => listeners.delete(listener),
  };
  const setState = (state: AudioContextState): void => {
    context.state = state;
    listeners.forEach((listener) => listener());
  };
  return { context: context as UnlockableContext & typeof context, setState };
}

function fakePads() {
  let pressed = false;
  const getGamepads = vi.fn(() => [
    { connected: true, buttons: [{ pressed }] } as unknown as Gamepad,
  ]);
  return { getGamepads, press: (down: boolean) => (pressed = down) };
}

describe("watchGamepadAudioUnlock", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("should resume the context and never need a gesture when the browser allows the resume", () => {
    const { context } = fakeContext(true);
    const pads = fakePads();
    const unlock = watchGamepadAudioUnlock({ getGamepads: pads.getGamepads, context });
    pads.press(true);
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS + GAMEPAD_UNLOCK_GRACE_MS);
    expect(context.resume).toHaveBeenCalledTimes(1);
    expect(unlock.needsGesture()).toBe(false);
    unlock.dispose();
  });

  it("should need a gesture when the context stays suspended after a gamepad press", () => {
    const { context } = fakeContext(false);
    const pads = fakePads();
    const unlock = watchGamepadAudioUnlock({ getGamepads: pads.getGamepads, context });
    const listener = vi.fn();
    unlock.subscribe(listener);
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS * 3);
    expect(unlock.needsGesture()).toBe(false);
    pads.press(true);
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS + GAMEPAD_UNLOCK_GRACE_MS);
    expect(context.resume).toHaveBeenCalled();
    expect(unlock.needsGesture()).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    unlock.dispose();
  });

  it("should clear the need and stop polling when a key or tap starts the context", () => {
    const { context, setState } = fakeContext(false);
    const pads = fakePads();
    const unlock = watchGamepadAudioUnlock({ getGamepads: pads.getGamepads, context });
    pads.press(true);
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS + GAMEPAD_UNLOCK_GRACE_MS);
    expect(unlock.needsGesture()).toBe(true);
    setState("running");
    expect(unlock.needsGesture()).toBe(false);
    const polls = pads.getGamepads.mock.calls.length;
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS * 5);
    expect(pads.getGamepads.mock.calls.length).toBe(polls);
    unlock.dispose();
  });

  it("should resume once per press when a button is held down", () => {
    const { context } = fakeContext(false);
    const pads = fakePads();
    const unlock = watchGamepadAudioUnlock({ getGamepads: pads.getGamepads, context });
    pads.press(true);
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS * 6);
    expect(context.resume).toHaveBeenCalledTimes(1);
    unlock.dispose();
  });

  it("should do nothing when the browser has no Gamepad API", () => {
    const { context } = fakeContext(false);
    const unlock = watchGamepadAudioUnlock({ getGamepads: undefined, context });
    vi.advanceTimersByTime(GAMEPAD_UNLOCK_POLL_MS * 5);
    expect(context.resume).not.toHaveBeenCalled();
    expect(unlock.needsGesture()).toBe(false);
    unlock.dispose();
  });
});
