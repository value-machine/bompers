import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "tests/test-utils";
import { createAudioEngine, type SoundHost } from "@/features/sound/services/audioEngine";
import { useAudioEngine, useSoundStatus } from "@/features/sound/hooks/useAudioEngine";

const memoryStorage = (): Storage => {
  const items = new Map<string, string>();
  return {
    get length() {
      return items.size;
    },
    clear: () => items.clear(),
    getItem: (key) => items.get(key) ?? null,
    key: (index) => [...items.keys()][index] ?? null,
    removeItem: (key) => void items.delete(key),
    setItem: (key, value) => void items.set(key, value),
  };
};

/** A browser without Web Audio (the silent engine); the storage outlives a page load. */
const hostWith = (storage: Storage): SoundHost => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  fetch: vi.fn(),
  localStorage: storage,
});

describe("useSoundStatus", () => {
  it("should report muted when the player toggles the mute and clear it when they toggle back", () => {
    const { result } = renderHookWithProviders(() => ({
      engine: useAudioEngine(),
      status: useSoundStatus(),
    }));
    expect(result.current.status).toBeNull();

    act(() => result.current.engine.toggleMute());
    expect(result.current.status).toBe("muted");

    act(() => result.current.engine.toggleMute());
    expect(result.current.status).toBeNull();
  });
});

describe("audio engine mute", () => {
  it("should start muted when the mute was saved on an earlier visit", () => {
    const storage = memoryStorage();
    createAudioEngine(hostWith(storage)).toggleMute();

    expect(createAudioEngine(hostWith(storage)).isMuted()).toBe(true);
  });
});
