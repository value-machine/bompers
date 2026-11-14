import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import type { HitZone } from "@/features/dive/types/dive.types";

type DiveTunables = GameTunables["dive"];

/**
 * Front or back, from the hit direction (unit vector attacker → victim) and the victim's facing.
 * A hit travelling the way the victim looks comes from behind. Hits from above or below
 * (dot ≈ 0) count as front.
 */
export function classifyHitZone(
  hitDirection: Vec2,
  victimFacing: -1 | 1,
  tunables: Pick<DiveTunables, "backZoneMinDot">
): HitZone {
  return hitDirection.x * victimFacing > tunables.backZoneMinDot ? "back" : "front";
}

/** Health chunks for a zone; front 0 / back 1 or 4 is a tunables change only. */
export const hitDamage = (
  zone: HitZone,
  tunables: Pick<DiveTunables, "frontHitDamage" | "backHitDamage">
): number => (zone === "back" ? tunables.backHitDamage : tunables.frontHitDamage);
