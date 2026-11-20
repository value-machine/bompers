import { describe, expect, it } from "vitest";
import {
  BACKDROP_THEMES,
  DEFAULT_BACKDROP_THEME_ID,
  exportBackdropThemes,
  isBackdropThemeId,
  resolveBackdropTheme,
} from "@/features/backdrop-themes/services/backdropThemeRegistry";
import { GAME_PALETTE } from "@/shared/config/gamePalette";

describe("backdrop theme registry", () => {
  it("should key every theme by its own kebab-case id when registered", () => {
    for (const [key, theme] of Object.entries(BACKDROP_THEMES)) {
      expect(theme.id).toBe(key);
      expect(theme.id).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("should keep today's meadow look as the default when a level names no theme", () => {
    expect(DEFAULT_BACKDROP_THEME_ID).toBe("meadow");
    const meadow = resolveBackdropTheme(undefined);
    expect(meadow.sky).toEqual(GAME_PALETTE.sky);
    expect(meadow.far.color).toBe(GAME_PALETTE.backdrop.hillsFar);
    expect(meadow.near.color).toBe(GAME_PALETTE.backdrop.hillsNear);
  });

  it("should resolve the default theme when the id is unknown or inherited", () => {
    expect(isBackdropThemeId("toString")).toBe(false);
    expect(resolveBackdropTheme("toString").id).toBe("meadow");
    expect(resolveBackdropTheme("lava").id).toBe("meadow");
    expect(resolveBackdropTheme("lava-cave").id).toBe("lava-cave");
  });

  it("should ship the owner's first themes with lighting unused when exported", () => {
    const ids = exportBackdropThemes().map((theme) => theme.id);
    expect(ids).toEqual([
      "meadow",
      "night-sky",
      "lava-cave",
      "snowy-peaks",
      "underwater",
      "city-rooftops",
    ]);
    for (const theme of Object.values(BACKDROP_THEMES)) expect(theme.light.strength).toBe(0);
    expect(exportBackdropThemes()[1]?.sky).toEqual({ top: "#14123a", bottom: "#4a3a7e" });
  });

  it("should keep particles at most 48 per theme when a theme has ambient particles", () => {
    for (const theme of Object.values(BACKDROP_THEMES)) {
      expect(theme.ambient?.count ?? 0).toBeLessThanOrEqual(48);
    }
  });
});
