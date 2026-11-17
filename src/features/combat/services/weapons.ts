import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { CraterShape } from "@/shared/types/craterShape.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { emitCombatEvent, fighterFor, type HitWorld } from "@/features/combat/services/combatState";
import type { RocketKind } from "@/features/combat/types/combat.types";

/**
 * Held weapons: how each fires (a projectile per press, or a held spray), which projectile a
 * projectile weapon fires, the numbers they share (ammo, cooldown, recoil, flight speed, lifetime),
 * and arming players from crate pickups. Projectile weapons fire a rocket kind through the one
 * flight path in `rockets.ts` (homing-missiles D1); a new weapon adds a `MODE_OF` row, a `KIND_OF`
 * row if it fires rockets, and a tunables section.
 */
export interface ProjectileWeaponTunables {
  speed: number;
  ammo: number;
  fireCooldown: number;
  recoil: number;
  maxLifetime: number;
  /** Blast power of the explosion it fires (blast-power D1). */
  power: number;
  /** Shape its blast cuts out of terrain (terrain-field D5). */
  craterShape: CraterShape;
}

/**
 * How a weapon fires (fire-spread b1): `projectile` = one rocket kind per press; `spray` = held,
 * draining seconds of fuel through the `sprayAttack` hook (the torch). A new weapon is a compile
 * error here until it has a mode.
 */
export type WeaponMode = "projectile" | "spray";

const MODE_OF: Readonly<Record<WeaponItemId, WeaponMode>> = {
  "rocket-launcher": "projectile",
  "homing-launcher": "projectile",
  torch: "spray",
};

export const weaponMode = (itemId: WeaponItemId): WeaponMode => MODE_OF[itemId];

/** Weapons that fire a rocket kind. */
export type ProjectileWeaponId = Exclude<WeaponItemId, "torch">;

export const isProjectileWeapon = (itemId: WeaponItemId): itemId is ProjectileWeaponId =>
  MODE_OF[itemId] === "projectile";

const KIND_OF: Readonly<Record<ProjectileWeaponId, RocketKind>> = {
  "rocket-launcher": "rocket",
  "homing-launcher": "homing",
};

export const rocketKindOf = (itemId: ProjectileWeaponId): RocketKind => KIND_OF[itemId];

/**
 * What every held weapon has: `ammo` (shots, or seconds of fuel for a spray weapon), the
 * cooldown after a shot, and the recoil per shot.
 */
export interface HeldWeaponTunables {
  ammo: number;
  fireCooldown: number;
  recoil: number;
}

/** The tunables section of a rocket kind. */
export const flightTunables = (
  tunables: GameTunables,
  kind: RocketKind
): ProjectileWeaponTunables =>
  kind === "homing" ? tunables.combat.homing : tunables.combat.rocket;

/** The shared numbers of a held weapon (ammo, cooldown, recoil). */
export const weaponTunables = (tunables: GameTunables, itemId: WeaponItemId): HeldWeaponTunables =>
  isProjectileWeapon(itemId)
    ? flightTunables(tunables, rocketKindOf(itemId))
    : tunables.combat.torch;

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
