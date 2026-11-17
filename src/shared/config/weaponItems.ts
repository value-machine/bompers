import type { WeaponItemId } from "@/shared/types/weaponItems.types";

/** Every weapon item id; a new weapon is a compile error here until it is listed. */
const WEAPON_ITEMS: Readonly<Record<WeaponItemId, true>> = {
  "rocket-launcher": true,
  "homing-launcher": true,
  torch: true,
};

/** True for catalog item ids that are weapons (a drop point may also list other items later). */
export const isWeaponItemId = (itemId: string): itemId is WeaponItemId =>
  Object.prototype.hasOwnProperty.call(WEAPON_ITEMS, itemId);
