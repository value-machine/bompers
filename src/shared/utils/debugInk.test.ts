import { afterEach, describe, expect, it, vi } from "vitest";
import { GAME_PALETTE } from "@/shared/config/gamePalette";

const load = async (search: string) => {
  window.history.replaceState(null, "", `/${search}`);
  vi.resetModules();
  return import("@/shared/utils/debugInk");
};

afterEach(() => {
  window.history.replaceState(null, "", "/");
});

describe("debugInk", () => {
  it("should return the normal colour when the page has no debugInk flag", async () => {
    const { DEBUG_INK_ON, inkColor } = await load("");
    expect(DEBUG_INK_ON).toBe(false);
    expect(inkColor("fireBody")).toBe(GAME_PALETTE.ink);
    expect(inkColor("stains", 0x123456)).toBe(0x123456);
  });

  it("should give every layer its own debug colour when the page has ?debugInk=1", async () => {
    const { DEBUG_INK_LAYERS, DEBUG_INK_ON, inkColor } = await load("?debugInk=1");
    expect(DEBUG_INK_ON).toBe(true);
    expect(inkColor("fireBody")).toBe(DEBUG_INK_LAYERS.fireBody.color);
    const colors = Object.values(DEBUG_INK_LAYERS).map((layer) => layer.color);
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors).not.toContain(GAME_PALETTE.ink);
  });
});
