import { useEffect, useRef, useState } from "react";
import { createGameInputReader } from "@/shared/services/gameInputService";
import { getMenuFocusModality } from "@/shared/services/menuFocusModality";
import type { MenuInput } from "@/shared/types/gameInput.types";
import { EMPTY_MENU_INPUT, INPUT_DEVICES } from "@/shared/utils/gameInputMapping";
import type { LobbyAction, LobbyButton } from "@/features/lobby/types/lobby.types";

/** Live state of one input device, for the on-screen indicators. */
export interface DeviceActivity {
  /** Connected (keyboard halves always are). */
  present: boolean;
  /** Any of its menu buttons is held right now. */
  active: boolean;
}

const BUTTONS: readonly LobbyButton[] = ["up", "down", "left", "right", "confirm", "back"];

const isActive = (menu: MenuInput): boolean => BUTTONS.some((button) => menu[button]);

/** Presses (held now, not in the previous sample) as lobby actions, device order. */
function pressesOf(menus: readonly MenuInput[], previous: readonly MenuInput[]): LobbyAction[] {
  const actions: LobbyAction[] = [];
  menus.forEach((menu, index) => {
    const device = INPUT_DEVICES[index];
    if (!device) return;
    const before = previous[index] ?? EMPTY_MENU_INPUT;
    for (const button of BUTTONS) {
      if (menu[button] && !before[button]) actions.push({ type: "press", device, button });
    }
  });
  return actions;
}

const activityKey = (activity: readonly DeviceActivity[]): string =>
  activity.map((d) => `${d.present ? 1 : 0}${d.active ? 1 : 0}`).join("");

/**
 * Reads every keyboard half and gamepad once per animation frame while mounted and hands
 * each new button press to `onPress`. Returns per-device activity (re-rendering only when it
 * changes), so players can see which input the game hears.
 */
export function useLobbyInput(onPress: (action: LobbyAction) => void): DeviceActivity[] {
  const onPressRef = useRef(onPress);
  onPressRef.current = onPress;
  const [activity, setActivity] = useState<DeviceActivity[]>(() =>
    INPUT_DEVICES.map(() => ({ present: false, active: false }))
  );

  useEffect(() => {
    const reader = createGameInputReader(window);
    // Keys held while the lobby opens (the round's last jump) are not new presses.
    let previous = reader.sampleMenus();
    let shownKey = "";
    let frame = 0;
    const onFrame = (): void => {
      const menus = reader.sampleMenus();
      pressesOf(menus, previous).forEach((action) => {
        // Key and pad presses show the menu focus mark; pointer use hides it (controller-focus D2).
        getMenuFocusModality().noteMenuPress();
        onPressRef.current(action);
      });
      previous = menus;
      const next = menus.map((menu) => ({ present: menu.present, active: isActive(menu) }));
      const key = activityKey(next);
      if (key !== shownKey) {
        shownKey = key;
        setActivity(next);
      }
      frame = requestAnimationFrame(onFrame);
    };
    frame = requestAnimationFrame(onFrame);
    return () => {
      cancelAnimationFrame(frame);
      reader.dispose();
    };
  }, []);

  return activity;
}
