import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import type { LevelDefinition } from "@/features/level/api/levelApi";
import { createLobbyState, reduceLobby } from "@/features/lobby/services/lobbyMenu";
import { lobbyView } from "@/features/lobby/services/lobbyView";

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
    const view = lobbyView(state, { tunables: DEFAULT_GAME_TUNABLES, context, level: null });
    expect(view.players).toBe(1);
    expect(view.slots[0]).toEqual({ slot: 0, deviceIndex: 3, deviceLabel: "Pad 2", leaveKey: "B" });
    expect(view.devices.find((d) => d.key === "gamepad:1")?.slot).toBe(0);
    expect(view.startable).toBe(true);
  });

  it("should note the level's own match length and gravity when the level sets them", () => {
    const state = createLobbyState(DEFAULT_GAME_TUNABLES);
    const level = levelWith({ cellSize: 8, gravity: 0.5, matchDurationS: 90 });
    const view = lobbyView(state, { tunables: DEFAULT_GAME_TUNABLES, context, level });
    expect(view.duration).toBe("3:00");
    expect(view.levelDuration).toBe("1:30");
    expect(view.levelGravity).toBe("0.5× = 0.5×");
  });
});
