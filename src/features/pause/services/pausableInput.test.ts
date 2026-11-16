import { describe, expect, it } from "vitest";
import type { MenuInput, PlayerInput, SlotSources } from "@/shared/types/gameInput.types";
import {
  EMPTY_MENU_INPUT,
  EMPTY_PLAYER_INPUT,
  INPUT_DEVICES,
} from "@/shared/utils/gameInputMapping";
import { createPausableInput } from "@/features/pause/services/pausableInput";
import type { PauseButton, PauseLink } from "@/features/pause/types/pause.types";

/** Left keyboard half in slot 0, pad 0 in slot 1. */
const SOURCES: SlotSources = [INPUT_DEVICES[0] ?? null, INPUT_DEVICES[2] ?? null];
const PAD0 = 2;

interface Held {
  player?: Partial<PlayerInput>;
  menu?: Partial<MenuInput>;
}

/** A fake reader and link: `set` holds buttons for the next frame, the link opens on pause. */
function rig() {
  const frame: { players: PlayerInput[]; menus: MenuInput[] } = { players: [], menus: [] };
  const set = (slot: number, device: number, held: Held = {}): void => {
    frame.players = SOURCES.map((_, i) => ({
      ...EMPTY_PLAYER_INPUT,
      connected: true,
      ...(i === slot ? held.player : {}),
    }));
    frame.menus = INPUT_DEVICES.map((_, i) => ({
      ...EMPTY_MENU_INPUT,
      present: true,
      ...(i === device ? held.menu : {}),
    }));
  };
  set(-1, -1);
  const presses: PauseButton[] = [];
  let open = false;
  const pause: PauseLink = {
    isOpen: () => open,
    press: (button) => {
      presses.push(button);
      if (button === "pause" || button === "back") open = !open && button === "pause";
    },
  };
  const next = createPausableInput(
    { sample: () => frame.players, sampleMenus: () => frame.menus },
    { pause, sources: SOURCES }
  );
  return { set, next, presses, isOpen: () => open };
}

describe("createPausableInput", () => {
  it("should hold the match when a player pressed pause and the menu is still open", () => {
    const { set, next, isOpen } = rig();
    expect(next()).not.toBeNull();
    set(1, PAD0, { player: { pause: true }, menu: { confirm: true } });
    expect(next()).toBeNull();
    expect(isOpen()).toBe(true);
    set(-1, -1);
    expect(next()).toBeNull();
  });

  it("should not confirm a menu row when pad Start opens the menu", () => {
    const { set, next, presses } = rig();
    set(1, PAD0, { player: { pause: true }, menu: { confirm: true } });
    next();
    next();
    expect(presses).toEqual(["pause"]);
  });

  it("should ignore menu presses when the device is not playing the match", () => {
    const { set, next, presses } = rig();
    set(0, 0, { player: { pause: true } });
    next();
    set(-1, 3, { menu: { down: true } });
    next();
    set(-1, PAD0, { menu: { down: true } });
    next();
    expect(presses).toEqual(["pause", "down"]);
  });

  it("should report a resume and hide the held jump when back closes the menu", () => {
    const { set, next } = rig();
    set(0, 0, { player: { pause: true } });
    next();
    set(0, 0, { player: { jump: true }, menu: { back: true } });
    expect(next()).toBeNull();
    const resumed = next();
    expect(resumed?.resumed).toBe(true);
    expect(resumed?.back).toBe(false);
    expect(resumed?.inputs[0]?.jump).toBe(false);
    set(-1, -1);
    expect(next()?.resumed).toBe(false);
  });
});
