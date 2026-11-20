import { act } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "tests/test-utils";
import { createAudioEngine, type SoundHost } from "@/features/sound/services/audioEngine";
import { useMuted } from "@/features/sound/hooks/useAudioEngine";

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

describe("useMuted", () => {
  it("should re-render with the new state when the mute toggles", () => {
    const engine = createAudioEngine(hostWith(memoryStorage()));
    const { result } = renderHookWithProviders(() => useMuted(engine));
    expect(result.current).toBe(false);

    act(() => engine.toggleMute());

    expect(result.current).toBe(true);
  });

  it("should start muted when the mute was saved on an earlier visit", () => {
    const storage = memoryStorage();
    createAudioEngine(hostWith(storage)).toggleMute();

    const { result } = renderHookWithProviders(() =>
      useMuted(createAudioEngine(hostWith(storage)))
    );

    expect(result.current).toBe(true);
  });
});
