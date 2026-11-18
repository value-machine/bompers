import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import type { FallingBody } from "@/shared/types/fallingBody.types";

export type KnockoutTunables = GameTunables["feel"]["knockout"];

/** A goo droplet in flight; it turns into a splat the instant it touches terrain. */
export interface GooDroplet {
  key: string;
  slot: number;
  body: FallingBody;
  age: number;
}

/** The helmet or the weapon tube, flying off as a solid piece until the respawn. */
export interface KnockoutPiece {
  key: string;
  kind: "helmet" | "tube";
  slot: number;
  itemId: WeaponItemId | null;
  body: FallingBody;
  age: number;
  /** Age at which it vanishes (the victim's respawn). */
  lifeSeconds: number;
}

/** A goo stain on terrain where a droplet landed. Normal points out of the surface. */
export interface GooSplat {
  key: string;
  slot: number;
  x: number;
  y: number;
  nx: -1 | 0 | 1;
  ny: -1 | 0 | 1;
  /** The droplet's radius (the splat's size scales with it). */
  radius: number;
  age: number;
}
