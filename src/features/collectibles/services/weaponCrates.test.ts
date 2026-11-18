import { describe, expect, it } from "vitest";
import { DEFAULT_GAME_TUNABLES } from "@/shared/config/gameTunables";
import { ALL_WEAPON_ITEM_IDS } from "@/shared/config/weaponItems";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { EMPTY_PLAYER_INPUT } from "@/shared/utils/gameInputMapping";
import type { PlayerInput } from "@/shared/types/gameInput.types";
import { buildTerrainFromLevel } from "@/features/arena/api/arenaApi";
import type { LevelDefinition, LevelDrop } from "@/features/level/api/levelApi";
import { createPlayer, stepPlayers, type PlayerState } from "@/features/player/api/playerApi";
import {
  createCombatState,
  stepCombat,
  takeWeaponPickups,
  type CombatEvent,
  type CombatState,
} from "@/features/combat/api/combatApi";
import {
  createWeaponCratesState,
  stepWeaponCrates,
} from "@/features/collectibles/services/weaponCrates";
import type { WeaponCratesState } from "@/features/collectibles/types/collectibles.types";

// Moved from combatSim.test.ts ("combat — pickups") when the crates moved here; the test bodies
// are unchanged apart from where the crates live. The world steps the chain the match runs:
// players → combat (step 3) → crates + takeWeaponPickups (step 3a).
// Cell size 8. Stone floor top y = 320 (x 0–1200). Thin stone wall x 800–808 (y 0–320).
const level: LevelDefinition = {
  formatVersion: 1,
  meta: { levelId: "crates", title: "Crates" },
  settings: { cellSize: 8, gravity: 1 },
  worldSize: { w: 1200, h: 400 },
  terrain: [
    {
      shape: { type: "rect", x: 0, y: 320, w: 1200, h: 32 },

      materialId: "stone",
    },
    { shape: { type: "rect", x: 800, y: 0, w: 8, h: 320 }, materialId: "stone" },
  ],
  spawns: [],
  drops: [],
  collectibles: [],
  bounds: { x: 0, y: -400, w: 1200, h: 800 },
};

const FLOOR_Y = 320;
const dt = 1 / 120;
const C = DEFAULT_GAME_TUNABLES.combat;

type InputPatch = Partial<PlayerInput>;

interface World {
  players: PlayerState[];
  combat: CombatState;
  crates: WeaponCratesState;
  step: (inputs?: InputPatch[], steps?: number) => void;
  /** Every event seen since the world was created (the live log is pruned). */
  seen: CombatEvent[];
}

interface WorldArgs {
  at: { x: number; y: number }[];
  drops: LevelDrop[];
  /** The match's weapons setting; default = the engine's (every weapon). */
  weaponIds?: readonly WeaponItemId[];
}

function createWorld({ at, drops, weaponIds }: WorldArgs): World {
  const base = DEFAULT_GAME_TUNABLES;
  const tunables = weaponIds ? { ...base, match: { ...base.match, weaponIds } } : base;
  const terrain = buildTerrainFromLevel(level);
  const players = at.map((point, slot) => createPlayer(slot, point, tunables));
  const combat = createCombatState();
  const crates = createWeaponCratesState(tunables);
  const seen: CombatEvent[] = [];
  let time = 0;
  let lastSeq = 0;
  const step = (patches: InputPatch[] = [], steps = 1): void => {
    for (let i = 0; i < steps; i += 1) {
      const inputs = players.map((_, slot) => ({
        ...EMPTY_PLAYER_INPUT,
        connected: true,
        ...patches[slot],
      }));
      const world = { combat, players, tunables, timeSeconds: time };
      stepPlayers({ players, inputs, terrain, tunables, dt });
      stepCombat({ ...world, inputs, terrain, bounds: level.bounds, dt });
      const inPlay = players.filter((player) => !combat.fighters.get(player.id)?.eliminated);
      const result = stepWeaponCrates({
        crates,
        drops,
        players: inPlay,
        terrain,
        bounds: level.bounds,
        tunables,
        dt,
      });
      takeWeaponPickups({ ...world, players: inPlay }, result);
      for (const event of combat.events) if (event.seq > lastSeq) seen.push(event);
      lastSeq = combat.nextSeq - 1;
      time += dt;
    }
  };
  step([], 60); // settle on the floor
  return { players, combat, crates, step, seen };
}

const eventsOf = <T extends CombatEvent["type"]>(world: World, type: T) =>
  world.seen.filter((event): event is Extract<CombatEvent, { type: T }> => event.type === type);

const shoot = (world: World, aim: InputPatch, after = 120): void => {
  world.step([{ ...aim, fire: true }]);
  world.step([aim], after);
};

describe("collectibles — weapon crates", () => {
  const drops: LevelDrop[] = [{ at: { x: 1000, y: -40 } }];

  it("should drop a launcher that falls and lands on the terrain when the first drop is due", () => {
    const world = createWorld({ at: [{ x: 100, y: FLOOR_Y }], drops });
    world.step([], Math.ceil((C.drops.firstDelaySeconds + 2) / dt));
    const [pickup] = world.crates.list;
    expect(eventsOf(world, "pickupSpawned")).toHaveLength(1);
    expect(pickup).toMatchObject({ x: 1000, y: FLOOR_Y, grounded: true });
  });

  it("should arm the player who touches it and drop the launcher when the ammo runs out", () => {
    const world = createWorld({ at: [{ x: 1000, y: FLOOR_Y }], drops });
    world.step([], Math.ceil((C.drops.firstDelaySeconds + 2) / dt));
    expect(world.crates.list).toHaveLength(0);
    expect(world.combat.fighters.get("p0")!.weapon?.ammo).toBe(C.rocket.ammo);
    for (let i = 0; i < C.rocket.ammo; i += 1) {
      shoot(world, { aimX: -1 }, Math.ceil(C.rocket.fireCooldown / dt) + 1);
    }
    expect(eventsOf(world, "rocketFired")).toHaveLength(C.rocket.ammo);
    expect(world.combat.fighters.get("p0")!.weapon).toBeNull();
    shoot(world, { aimX: -1 }, Math.ceil(C.rocket.fireCooldown / dt) + 1);
    expect(eventsOf(world, "rocketFired")).toHaveLength(C.rocket.ammo);
  });

  it("should cycle every weapon the game has when the weapons setting is auto", () => {
    // The player stands under the drop point and takes every crate, so the schedule never stalls.
    const world = createWorld({ at: [{ x: 1000, y: FLOOR_Y }], drops });
    const crates = ALL_WEAPON_ITEM_IDS.length;
    world.step([], Math.ceil((C.drops.firstDelaySeconds + C.drops.intervalSeconds * crates) / dt));
    const spawned = eventsOf(world, "pickupSpawned").map((event) => event.itemId);
    expect(spawned.slice(0, ALL_WEAPON_ITEM_IDS.length)).toEqual([...ALL_WEAPON_ITEM_IDS]);
  });

  it("should alternate only the chosen weapons when the weapons setting is narrowed", () => {
    const weaponIds: WeaponItemId[] = ["torch", "freeze-ray"];
    const world = createWorld({ at: [{ x: 100, y: FLOOR_Y }], drops, weaponIds });
    world.step([], Math.ceil((C.drops.firstDelaySeconds + C.drops.intervalSeconds * 5) / dt));
    expect(world.crates.list.map((crate) => crate.itemId)).toEqual(["torch", "freeze-ray"]);
  });

  it("should drop no crates when the weapons setting is none", () => {
    const world = createWorld({ at: [{ x: 100, y: FLOOR_Y }], drops, weaponIds: [] });
    world.step([], Math.ceil((C.drops.firstDelaySeconds + C.drops.intervalSeconds * 5) / dt));
    expect(world.crates.list).toHaveLength(0);
    expect(eventsOf(world, "pickupSpawned")).toHaveLength(0);
  });

  it("should not drop more than maxActive pickups when nobody collects them", () => {
    const world = createWorld({ at: [{ x: 100, y: FLOOR_Y }], drops });
    world.step([], Math.ceil((C.drops.firstDelaySeconds + C.drops.intervalSeconds * 5) / dt));
    expect(world.crates.list.length).toBe(C.drops.maxActive);
  });
});
