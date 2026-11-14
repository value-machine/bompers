import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { HitZone } from "@/features/dive/types/dive.types";

type DiveTunables = GameTunables["dive"];

/**
 * Front or back, from the victim's facing and the hit's travel direction (attacker → victim,
 * need not be unit). A hit travelling the way the victim looks comes from behind; a purely
 * vertical hit is front. Same signature and rule as combat's `classifyHitZone`, which replaces
 * this one in phase 2.
 */
export function classifyHitZone(victimFacing: -1 | 1, direction: Vec2): HitZone {
  return direction.x * victimFacing > 0 ? "back" : "front";
}

/**
 * Health chunks for a zone; front 0 / back 1 or 4 is a tunables change only. Phase-1 stand-in
 * for combat's `hitDamageFor` + `combat.hitDamage.contact`.
 */
export const hitDamage = (
  zone: HitZone,
  tunables: Pick<DiveTunables, "frontHitDamage" | "backHitDamage">
): number => (zone === "back" ? tunables.backHitDamage : tunables.frontHitDamage);
