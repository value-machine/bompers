import type { GameTunables } from "@/shared/types/gameTunables.types";

/**
 * Blast power (blast-power D1, D3): one number per explosion, 0–100, from the weapon that made it
 * (the rocket is 50). It scales everything the explosion does in straight lines, so a new weapon
 * is tuned by picking its power:
 * - **reach** — players this close (nearest body point) are pushed and hit;
 * - **push** — speed added at the centre, falling off linearly to `minFalloff` at the reach;
 * - **crater reach** — breakable terrain clears where distance × toughness ≤ this.
 */

/** How far the blast reaches players, world units. */
export function blastReach(tunables: GameTunables, power: number): number {
  return Math.max(0, power) * tunables.combat.blast.reachPerPower;
}

/** Speed the blast adds to a player `distance` units away (nearest body point); 0 past the reach. */
export function blastPushAt(tunables: GameTunables, power: number, distance: number): number {
  const reach = blastReach(tunables, power);
  if (reach <= 0 || distance > reach) return 0;
  const { pushPerPower, minFalloff } = tunables.combat.blast;
  return power * pushPerPower * Math.max(minFalloff, 1 - distance / reach);
}

/** Crater reach at toughness 1, world units; a material's cut is this ÷ its toughness. */
export function craterReach(tunables: GameTunables, power: number): number {
  return Math.max(0, power) * tunables.combat.blast.craterPerPower;
}

/** Centre push of the strongest weapon's blast (the kill-zone margin counts one per launch). */
export function maxBlastPush(tunables: GameTunables): number {
  const { rocket, homing, blast } = tunables.combat;
  return Math.max(rocket.power, homing.power) * blast.pushPerPower;
}
