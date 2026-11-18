import type { Graphics } from "pixi.js";
import type { TubePart, TubeRole } from "@/shared/utils/weaponTube";

/**
 * Adds a weapon barrel's parts to `g`'s current path (fill or stroke it after). With `role`, only
 * the parts of that role: the barrel takes the helmet colour, the mouth the weapon accent.
 */
export function traceWeaponTube(
  g: Graphics,
  parts: readonly TubePart[],
  role?: TubeRole
): Graphics {
  for (const part of parts) {
    if (role && part.role !== role) continue;
    if (part.kind === "rect") g.roundRect(part.x, part.y, part.width, part.height, part.radius);
    else g.poly([...part.points], true);
  }
  return g;
}
