import { emitCombatEvent, fighterFor, type HitWorld } from "@/features/combat/services/combatState";
import type { HeldWeapon } from "@/features/combat/types/combat.types";

/**
 * Combat's side of weapon pickups: the crates themselves (drop, fall, touch) live in the
 * collectibles feature; `match` hands this step's result here. A collector gets the weapon with
 * full ammo, replacing what they held. Spawn and pickup land in the combat event log (sound reads
 * `pickupCollected`).
 */
export interface WeaponPickups {
  spawned: readonly { itemId: HeldWeapon["itemId"]; x: number; y: number }[];
  collected: readonly { itemId: HeldWeapon["itemId"]; slot: number }[];
}

export function takeWeaponPickups(world: HitWorld, pickups: WeaponPickups): void {
  const { combat, players, tunables, timeSeconds } = world;
  for (const { itemId, x, y } of pickups.spawned) {
    emitCombatEvent(combat, { type: "pickupSpawned", itemId, x, y }, timeSeconds);
  }
  for (const { itemId, slot } of pickups.collected) {
    const player = players.find((candidate) => candidate.slot === slot);
    if (!player) continue;
    fighterFor(combat, player, tunables).weapon = { itemId, ammo: tunables.combat.rocket.ammo };
    emitCombatEvent(combat, { type: "pickupCollected", itemId, slot }, timeSeconds);
  }
}
