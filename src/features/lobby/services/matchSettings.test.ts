import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import {
  applyMatchSettings,
  cycleOption,
  defaultMatchSettings,
  DURATION_OPTIONS,
  effectiveSettings,
  formatDuration,
  formatGravity,
  lobbyWeaponIds,
  toggleWeapon,
} from "@/features/lobby/services/matchSettings";
import { ALL_WEAPON_ITEM_IDS } from "@/shared/config/weaponItems";
import type { MatchSettings } from "@/features/lobby/types/lobby.types";

const LOBBY: MatchSettings = { durationSeconds: 90, gravityScale: 1.5, weaponsOff: [] };

describe("matchSettings", () => {
  it("should start from the engine defaults when the lobby opens", () => {
    const settings = defaultMatchSettings(DEFAULT_GAME_TUNABLES);
    expect(settings).toEqual({ durationSeconds: 180, gravityScale: 1, weaponsOff: [] });
    expect(DURATION_OPTIONS).toContain(settings.durationSeconds);
  });

  it("should wrap around the options when cycling past either end", () => {
    expect(cycleOption([1, 2, 3], 3, 1)).toBe(1);
    expect(cycleOption([1, 2, 3], 1, -1)).toBe(3);
    expect(cycleOption([1, 2, 3], 7, 1)).toBe(1);
  });

  it("should put the lobby's duration and gravity into the tunables without touching the defaults", () => {
    const tunables = applyMatchSettings(DEFAULT_GAME_TUNABLES, LOBBY);
    expect(tunables.match.durationSeconds).toBe(90);
    expect(tunables.world.gravity).toBe(DEFAULT_GAME_TUNABLES.world.gravity * 1.5);
    expect(DEFAULT_GAME_TUNABLES.match.durationSeconds).toBe(180);
  });

  it("should use the lobby's duration and multiply gravity when the level sets neither", () => {
    expect(effectiveSettings(DEFAULT_GAME_TUNABLES, LOBBY, { cellSize: 8, gravity: 0.5 })).toEqual({
      durationSeconds: 90,
      durationSetByLevel: false,
      weaponIds: ALL_WEAPON_ITEM_IDS,
      weaponsSetByLevel: false,
      gravityScale: 0.75,
    });
  });

  it("should hand the match every weapon except the ones switched off", () => {
    const off = toggleWeapon(toggleWeapon(LOBBY, "torch"), "rocket-launcher");
    expect(applyMatchSettings(DEFAULT_GAME_TUNABLES, off).match.weaponIds).toEqual([
      "homing-launcher",
      "freeze-ray",
    ]);
    expect(lobbyWeaponIds(toggleWeapon(off, "torch"))).toEqual([
      "homing-launcher",
      "torch",
      "freeze-ray",
    ]);
  });

  it("should hand the match no weapons when every weapon is switched off", () => {
    const none = ALL_WEAPON_ITEM_IDS.reduce(toggleWeapon, LOBBY);
    expect(applyMatchSettings(DEFAULT_GAME_TUNABLES, none).match.weaponIds).toEqual([]);
  });

  it("should let the level's weapons win over the lobby's when the level sets them", () => {
    const off = toggleWeapon(LOBBY, "torch");
    const settings = { cellSize: 8, gravity: 1, weaponIds: ["torch"] };
    expect(effectiveSettings(DEFAULT_GAME_TUNABLES, off, settings)).toMatchObject({
      weaponIds: ["torch"],
      weaponsSetByLevel: true,
    });
  });

  it("should let the level's match duration win over the lobby's when the level sets one", () => {
    const settings = { cellSize: 8, gravity: 1, matchDurationS: 45 };
    expect(effectiveSettings(DEFAULT_GAME_TUNABLES, LOBBY, settings)).toMatchObject({
      durationSeconds: 45,
      durationSetByLevel: true,
    });
  });

  it("should format durations as minutes and gravity as a multiplier", () => {
    expect(formatDuration(180)).toBe("3:00");
    expect(formatDuration(90)).toBe("1:30");
    expect(formatGravity(1.25)).toBe("1.25×");
    expect(formatGravity(0.6)).toBe("0.6×");
  });
});
