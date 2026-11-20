import { describe, expect, it } from "vitest";
import {
  BACKDROP_THEMES,
  DEFAULT_BACKDROP_THEME_ID,
  exportBackdropThemes,
  isBackdropThemeId,
  resolveBackdropTheme,
} from "@/features/backdrop/services/backdropThemeRegistry";
import { ambientPose, ambientSeeds } from "@/features/backdrop/services/backdropAmbient";
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
    expect(ids).toEqual(["meadow", "night-sky", "lava-cave", "snowy-peaks"]);
    for (const theme of Object.values(BACKDROP_THEMES)) expect(theme.light.strength).toBe(0);
    expect(exportBackdropThemes()[1]?.sky).toEqual({ top: "#14123a", bottom: "#4a3a7e" });
  });

  it("should keep particles at most 48 per theme when a theme has ambient particles", () => {
    for (const theme of Object.values(BACKDROP_THEMES)) {
      expect(theme.ambient?.count ?? 0).toBeLessThanOrEqual(48);
    }
  });
});

describe("ambientPose", () => {
  const screen = { width: 800, height: 600, cameraX: 0, nowMs: 0 };
  const seeds = ambientSeeds(20, 7);

  it("should keep every particle on screen when time and camera move", () => {
    for (const kind of ["stars", "snow", "embers"] as const) {
      for (const nowMs of [0, 1234, 98765]) {
        for (const seed of seeds) {
          const pose = ambientPose(kind, seed, { ...screen, nowMs, cameraX: -5000 });
          expect(pose.x).toBeGreaterThanOrEqual(0);
          expect(pose.x).toBeLessThan(800);
          expect(pose.y).toBeGreaterThanOrEqual(0);
          expect(pose.y).toBeLessThanOrEqual(600);
          expect(pose.alpha).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("should move snow down and embers up when time passes", () => {
    const seed = { x: 0.5, y: 0.5, size: 1, phase: 0 };
    const snow0 = ambientPose("snow", seed, screen).y;
    const snow1 = ambientPose("snow", seed, { ...screen, nowMs: 1000 }).y;
    expect(snow1).toBeGreaterThan(snow0);
    const ember0 = ambientPose("embers", seed, screen).y;
    const ember1 = ambientPose("embers", seed, { ...screen, nowMs: 1000 }).y;
    expect(ember1).toBeLessThan(ember0);
  });

  it("should keep stars in the upper sky when placed", () => {
    for (const seed of seeds) expect(ambientPose("stars", seed, screen).y).toBeLessThanOrEqual(360);
  });
});
