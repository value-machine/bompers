import type { Graphics } from "pixi.js";
import type { WeaponTubeParts } from "@/shared/utils/weaponTube";

/** Adds a weapon tube's parts to `g`'s current path (fill or stroke it after). */
export function traceWeaponTube(g: Graphics, tube: WeaponTubeParts): Graphics {
  for (const part of tube.parts) g.roundRect(part.x, part.y, part.width, part.height, part.radius);
  return g;
}
