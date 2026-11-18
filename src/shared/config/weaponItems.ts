import type { WeaponItemId } from "@/shared/types/weaponItems.types";

/** Every weapon item id; a new weapon is a compile error here until it is listed. */
const WEAPON_ITEMS: Readonly<Record<WeaponItemId, true>> = {
  "rocket-launcher": true,
  "homing-launcher": true,
  torch: true,
  "freeze-ray": true,
};

/**
 * Every weapon the game has, in listing order: the "auto" weapons setting (level-direction D6),
 * so a new weapon reaches old maps without editing them.
 */
export const ALL_WEAPON_ITEM_IDS = Object.keys(WEAPON_ITEMS) as readonly WeaponItemId[];

/** True for catalog item ids that are weapons. */
export const isWeaponItemId = (itemId: string): itemId is WeaponItemId =>
  Object.prototype.hasOwnProperty.call(WEAPON_ITEMS, itemId);
