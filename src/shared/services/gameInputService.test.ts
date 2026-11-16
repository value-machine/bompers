import { afterEach, describe, expect, it, vi } from "vitest";
import { createGameInputReader, type GameInputReader } from "@/shared/services/gameInputService";

const press = (type: "keydown" | "keyup", code: string, repeat = false): void => {
  window.dispatchEvent(new KeyboardEvent(type, { code, repeat }));
};

describe("gameInputService", () => {
  let reader: GameInputReader | null = null;
  afterEach(() => {
    reader?.dispose();
    vi.unstubAllGlobals();
  });

  it("should report a held key until it is released", () => {
    reader = createGameInputReader(window);
    press("keydown", "KeyD");
    expect(reader.sample()[0]?.moveX).toBe(1);
    press("keyup", "KeyD");
    expect(reader.sample()[0]?.moveX).toBe(0);
  });

  it("should release all keys when the window loses focus", () => {
    reader = createGameInputReader(window);
    press("keydown", "ArrowLeft");
    window.dispatchEvent(new Event("blur"));
    expect(reader.sample()[1]?.moveX).toBe(0);
  });

  it("should stop listening when disposed", () => {
    reader = createGameInputReader(window);
    reader.dispose();
    press("keydown", "KeyA");
    expect(reader.sample()[0]?.moveX).toBe(0);
  });

  it("should ignore auto-repeat of a key held since before the reader started", () => {
    reader = createGameInputReader(window);
    press("keydown", "Space", true);
    expect(reader.sampleMenus()[0]?.confirm).toBe(false);
    press("keydown", "Space");
    expect(reader.sampleMenus()[0]?.confirm).toBe(true);
  });

  it("should leave an empty slot disconnected when its source is null", () => {
    reader = createGameInputReader(window, [null, { kind: "keyboard", layout: "left" }]);
    press("keydown", "KeyA");
    const inputs = reader.sample();
    expect(inputs[0]?.connected).toBe(false);
    expect(inputs[1]?.moveX).toBe(-1);
  });

  it("should follow a pad that is unplugged and plugged back in mid-match", () => {
    const pad = (connected: boolean) => ({
      connected,
      axes: [1, 0, 0, 0],
      buttons: Array.from({ length: 17 }, () => ({ pressed: false })),
    });
    let pads: unknown[] = [pad(true)];
    vi.stubGlobal("navigator", { getGamepads: () => pads });
    reader = createGameInputReader(window, [{ kind: "gamepad", padIndex: 0 }]);
    expect(reader.sample()[0]).toMatchObject({ connected: true, moveX: 1 });
    pads = [null];
    expect(reader.sample()[0]).toMatchObject({ connected: false, moveX: 0 });
    pads = [pad(false)];
    expect(reader.sample()[0]?.connected).toBe(false);
    pads = [pad(true)];
    expect(reader.sample()[0]).toMatchObject({ connected: true, moveX: 1 });
  });
});
