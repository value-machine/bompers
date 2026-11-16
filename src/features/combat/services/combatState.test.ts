import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES, type GameTunables } from "@/shared/config/gameTunables";
import { createPlayer, type PlayerState } from "@/features/player/api/playerApi";
import {
  applyHit,
  classifyHitZone,
  createCombatState,
  fighterFor,
  type HitWorld,
} from "@/features/combat/services/combatState";
import type { Hit } from "@/features/combat/types/combat.types";

const C = DEFAULT_GAME_TUNABLES.combat;

/** Victim (slot 1) faces right at x 100; attacker is slot 0. */
function createHitWorld(tunables: GameTunables = DEFAULT_GAME_TUNABLES): {
  world: HitWorld;
  victim: PlayerState;
} {
  const players = [
    createPlayer(0, { x: 0, y: 0 }, tunables),
    createPlayer(1, { x: 100, y: 0 }, tunables),
  ];
  const victim = players[1]!;
  victim.facing = 1;
  const combat = createCombatState();
  for (const player of players) fighterFor(combat, player, tunables);
  return { world: { combat, players, tunables, timeSeconds: 10 }, victim };
}

const dive = (directionX: number): Hit => ({
  victimSlot: 1,
  attackerSlot: 0,
  kind: "contact",
  source: "dive",
  contactPoint: { x: 100, y: -14 },
  direction: { x: directionX, y: 0 },
});

const healthOf = (world: HitWorld): number => world.combat.fighters.get("p1")!.health;

describe("hits — zones", () => {
  it("should call a hit front when it travels against the victim's facing", () => {
    expect(classifyHitZone(1, { x: -1, y: 0 })).toBe("front");
    expect(classifyHitZone(-1, { x: 1, y: 0.5 })).toBe("front");
  });

  it("should call a hit back when it travels the same way the victim faces", () => {
    expect(classifyHitZone(1, { x: 1, y: 0 })).toBe("back");
    expect(classifyHitZone(-1, { x: -0.3, y: -1 })).toBe("back");
  });

  it("should call a purely vertical hit front", () => {
    expect(classifyHitZone(1, { x: 0, y: 1 })).toBe("front");
  });
});

describe("hits — applyHit", () => {
  it("should remove the front damage when a contact hit meets the victim's face", () => {
    const { world } = createHitWorld();
    const result = applyHit(world, dive(-1));
    expect(result).toEqual({ landed: true, zone: "front", damage: C.hitDamage.contact.front });
    expect(healthOf(world)).toBe(C.maxHealth - C.hitDamage.contact.front);
  });

  it("should remove the back damage when a contact hit comes from behind", () => {
    const { world } = createHitWorld();
    applyHit(world, dive(1));
    expect(healthOf(world)).toBe(C.maxHealth - C.hitDamage.contact.back);
    expect(world.combat.events[0]).toMatchObject({
      type: "playerHit",
      victimSlot: 1,
      byPlayerSlot: 0,
      source: "dive",
      kind: "contact",
      zone: "back",
      damage: C.hitDamage.contact.back,
      x: 100,
    });
  });

  it("should only bounce and deal the configured back damage when the table is changed", () => {
    const tunables: GameTunables = {
      ...DEFAULT_GAME_TUNABLES,
      combat: { ...C, hitDamage: { ...C.hitDamage, contact: { front: 0, back: 4 } } },
    };
    const front = createHitWorld(tunables).world;
    expect(applyHit(front, dive(-1))).toMatchObject({ landed: true, damage: 0 });
    expect(healthOf(front)).toBe(C.maxHealth);
    const back = createHitWorld(tunables).world;
    applyHit(back, dive(1));
    expect(healthOf(back)).toBe(0);
    expect(back.combat.fighters.get("p1")!.eliminated).toBe(true);
  });

  it("should deal nothing when the victim is spawn-protected", () => {
    const { world } = createHitWorld();
    world.combat.fighters.get("p1")!.invulnerableUntil = 11;
    expect(applyHit(world, dive(1)).landed).toBe(false);
    expect(healthOf(world)).toBe(C.maxHealth);
    expect(world.combat.events).toEqual([]);
  });

  it("should eliminate with credit and clamp at 0 when the damage exceeds the health left", () => {
    const { world } = createHitWorld();
    world.combat.fighters.get("p1")!.health = 1;
    applyHit(world, dive(1));
    expect(healthOf(world)).toBe(0);
    expect(world.combat.events.map((event) => event.type)).toEqual([
      "playerHit",
      "playerEliminated",
    ]);
    expect(world.combat.events[1]).toMatchObject({ victimSlot: 1, byPlayerSlot: 0, cause: "dive" });
    expect(applyHit(world, dive(1)).landed).toBe(false);
  });
});

describe("hits — crouch", () => {
  it("should halve the damage rounded down when the victim crouches", () => {
    const { world, victim } = createHitWorld();
    victim.crouching = true;
    expect(applyHit(world, dive(1))).toMatchObject({ landed: true, damage: 1 });
    expect(healthOf(world)).toBe(C.maxHealth - 1);
  });

  it("should deal no damage when a 1-chunk hit meets a crouching victim", () => {
    const { world, victim } = createHitWorld();
    victim.crouching = true;
    expect(applyHit(world, dive(-1))).toMatchObject({ landed: true, damage: 0 });
    expect(applyHit(world, { ...dive(1), kind: "blast" })).toMatchObject({ damage: 0 });
    expect(healthOf(world)).toBe(C.maxHealth);
  });
});
