import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { emitCombatEvent, fighterFor, type HitWorld } from "@/features/combat/services/combatState";
import type { RocketKind } from "@/features/combat/types/combat.types";

/**
 * Held weapons: which projectile each weapon fires, the numbers they share (ammo, cooldown,
 * recoil, flight speed, lifetime), and arming players from crate pickups. Every weapon fires a
 * rocket kind through the one flight path in `rockets.ts` (homing-missiles D1); a new weapon adds
 * a `KIND_OF` row and a tunables section.
 */
export interface ProjectileWeaponTunables {
  speed: number;
  ammo: number;
  fireCooldown: number;
  recoil: number;
  maxLifetime: number;
}

const KIND_OF: Readonly<Record<WeaponItemId, RocketKind>> = {
  "rocket-launcher": "rocket",
  "homing-launcher": "homing",
};

export const rocketKindOf = (itemId: WeaponItemId): RocketKind => KIND_OF[itemId];

/** The tunables section of a rocket kind. */
export const flightTunables = (
  tunables: GameTunables,
  kind: RocketKind
): ProjectileWeaponTunables =>
  kind === "homing" ? tunables.combat.homing : tunables.combat.rocket;

/** The tunables section of a held weapon. */
export const weaponTunables = (
  tunables: GameTunables,
  itemId: WeaponItemId
): ProjectileWeaponTunables => flightTunables(tunables, rocketKindOf(itemId));

/** The strongest recoil of any weapon: one shot per launch, so the kill-zone margin counts this. */
export const maxWeaponRecoil = (tunables: GameTunables): number =>
  Math.max(tunables.combat.rocket.recoil, tunables.combat.homing.recoil);

/**
 * Combat's side of weapon pickups: the crates themselves (drop, fall, touch) live in the
 * collectibles feature; `match` hands this step's result here. A collector gets the weapon with
 * its full ammo, replacing what they held. Spawn and pickup land in the combat event log (sound
 * reads `pickupCollected`).
 */
export interface WeaponPickups {
  spawned: readonly { itemId: WeaponItemId; x: number; y: number }[];
  collected: readonly { itemId: WeaponItemId; slot: number }[];
}

export function takeWeaponPickups(world: HitWorld, pickups: WeaponPickups): void {
  const { combat, players, tunables, timeSeconds } = world;
  for (const { itemId, x, y } of pickups.spawned) {
    emitCombatEvent(combat, { type: "pickupSpawned", itemId, x, y }, timeSeconds);
  }
  for (const { itemId, slot } of pickups.collected) {
    const player = players.find((candidate) => candidate.slot === slot);
    if (!player) continue;
    const ammo = weaponTunables(tunables, itemId).ammo;
    fighterFor(combat, player, tunables).weapon = { itemId, ammo };
    emitCombatEvent(combat, { type: "pickupCollected", itemId, slot }, timeSeconds);
  }
}
