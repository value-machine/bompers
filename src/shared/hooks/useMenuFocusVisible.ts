import { useSyncExternalStore } from "react";
import { getMenuFocusModality } from "@/shared/services/menuFocusModality";

/** True while menus should show their focus mark (last menu input was a key or pad press). */
export function useMenuFocusVisible(): boolean {
  const modality = getMenuFocusModality();
  return useSyncExternalStore(modality.subscribe, modality.isVisible, () => false);
}
