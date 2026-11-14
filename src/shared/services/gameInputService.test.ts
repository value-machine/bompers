import { afterEach, describe, expect, it } from "vitest";
import { createGameInputReader, type GameInputReader } from "@/shared/services/gameInputService";

const press = (type: "keydown" | "keyup", code: string): void => {
  window.dispatchEvent(new KeyboardEvent(type, { code }));
};

describe("gameInputService", () => {
  let reader: GameInputReader | null = null;
  afterEach(() => reader?.dispose());

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
});
