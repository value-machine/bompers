import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createLobbyState, reduceLobby } from "@/features/lobby/services/lobbyMenu";
import { lobbyView } from "@/features/lobby/services/lobbyView";
import type { SoundSettings } from "@/features/sound/api/soundApi";

const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  sfxVolume: 1,
  musicVolume: 0.6,
  sfxEnabled: true,
  musicEnabled: true,
};

const context = { playableLevelIds: ["a"] };
const levelWith = (settings: LevelDefinition["settings"]): LevelDefinition =>
  ({ meta: { levelId: "a", title: "A" }, settings }) as LevelDefinition;

describe("lobbyView", () => {
  it("should show the joined device per slot and which slot each device holds", () => {
    const { state } = reduceLobby(
      createLobbyState(DEFAULT_GAME_TUNABLES),
      { type: "press", device: { kind: "gamepad", padIndex: 1 }, button: "confirm" },
      context
    );
    const view = lobbyView(state, {
      tunables: DEFAULT_GAME_TUNABLES,
      context,
      level: null,
      sound: DEFAULT_SOUND_SETTINGS,
    });
    expect(view.players).toBe(1);
    expect(view.slots[0]).toEqual({ slot: 0, deviceIndex: 3, deviceLabel: "Pad 2", leaveKey: "B" });
    expect(view.devices.find((d) => d.key === "gamepad:1")?.slot).toBe(0);
    expect(view.startable).toBe(true);
  });

  it("should note the level's own match length and gravity when the level sets them", () => {
    const state = createLobbyState(DEFAULT_GAME_TUNABLES);
    const level = levelWith({ cellSize: 8, gravity: 0.5, matchDurationS: 90 });
    const view = lobbyView(state, {
      tunables: DEFAULT_GAME_TUNABLES,
      context,
      level,
      sound: DEFAULT_SOUND_SETTINGS,
    });
    expect(view.duration).toBe("3:00");
    expect(view.levelDuration).toBe("1:30");
    expect(view.levelGravity).toBe("0.5× = 0.5×");
  });

  it("should show the volumes as 0 to 10 when sound settings are given", () => {
    const view = lobbyView(createLobbyState(DEFAULT_GAME_TUNABLES), {
      tunables: DEFAULT_GAME_TUNABLES,
      context,
      level: null,
      sound: DEFAULT_SOUND_SETTINGS,
    });
    expect(view.musicVolume).toBe("6");
    expect(view.sfxVolume).toBe("10");
  });
});
