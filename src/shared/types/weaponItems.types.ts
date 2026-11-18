/**
 * A weapon a sky crate can hold (GDD § 3–4), by content-catalog item id. Shared because the
 * collectibles feature drops them and the combat feature arms and fires them; neither imports the
 * other. Runtime check: `isWeaponItemId` in `src/shared/config/weaponItems.ts`.
 */
export type WeaponItemId = "rocket-launcher" | "homing-launcher" | SprayWeaponItemId;

/** Weapons that are held and spray every step instead of firing a projectile per press. */
export type SprayWeaponItemId = "torch" | "freeze-ray";
