import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import { rectHitsSolid, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { LevelDrop } from "@/features/level/api/levelApi";
import type { PlayerState } from "@/features/player/api/playerApi";
import { fallSpeed, firstToucher, tickDropTimer } from "@/features/collectibles/services/skyDrops";
import type {
  CrateStepResult,
  PickupBurst,
  WeaponCrate,
  WeaponCratesState,
} from "@/features/collectibles/types/collectibles.types";

/**
 * Weapon crates (GDD § 3, § 4: weapons fall from the sky). Deterministic schedule: after
 * `firstDelaySeconds`, then every `intervalSeconds` while fewer than `maxActive` lie in the
 * arena, the next drop point (round-robin) releases a weapon crate. Which weapon: the match's
 * weapons setting (`tunables.match.weaponIds`, level-direction D6) in turn, by a counter over all
 * released crates (homing-missiles D4); an empty setting drops no crates. Crates fall with the match
 * gravity, land on terrain (and fall again when the ground is blasted away), vanish out of
 * bounds, and are taken by the first player touching them. Combat arms the collector (`match`
 * hands it the step result). Numbers: the `combat.drops` tunables.
 */
export const createWeaponCratesState = (tunables: GameTunables): WeaponCratesState => ({
  list: [],
  dropTimer: tunables.combat.drops.firstDelaySeconds,
  nextDropIndex: 0,
  nextItemIndex: 0,
  nextId: 1,
  landCount: 0,
});

export interface StepWeaponCratesArgs {
  crates: WeaponCratesState;
  /** The level's drop points. */
  drops: readonly LevelDrop[];
  /** Players who can take a crate (in play and not eliminated). */
  players: readonly PlayerState[];
  terrain: TerrainGrid;
  /** The in-bounds area (the match passes its kill zone): a crate below it or beside it vanishes. */
  bounds: Rect;
  tunables: GameTunables;
  dt: number;
  /** Where a taken crate's burst goes (the collectibles state's `bursts`; render only). */
  bursts: PickupBurst[];
}

export const crateBox = (crate: WeaponCrate, size: number): Rect => ({
  x: crate.x - size / 2,
  y: crate.y - size,
  w: size,
  h: size,
});

function spawnCrate(args: StepWeaponCratesArgs, result: CrateStepResult): void {
  const { crates: state, drops } = args;
  const weapons = args.tunables.match.weaponIds;
  if (weapons.length === 0) return;
  const drop = drops[state.nextDropIndex % drops.length];
  state.nextDropIndex += 1;
  const itemId = weapons[state.nextItemIndex % weapons.length];
  if (!drop || !itemId) return;
  state.nextItemIndex += 1;
  state.list.push({
    id: state.nextId,
    itemId,
    x: drop.at.x,
    y: drop.at.y,
    vy: 0,
    grounded: false,
    ageSeconds: 0,
    groundedSeconds: 0,
  });
  state.nextId += 1;
  result.spawned.push({ itemId, x: drop.at.x, y: drop.at.y });
}

function stepDropSchedule(args: StepWeaponCratesArgs, result: CrateStepResult): void {
  const { crates: state, drops, tunables, dt } = args;
  const schedule = tunables.combat.drops;
  const tick = tickDropTimer(state.dropTimer, { schedule, active: state.list.length, dt });
  state.dropTimer = tick.timer;
  if (tick.due && drops.length > 0) spawnCrate(args, result);
}

/** Snaps the crate onto the top of the cell row it entered; counts the landing (its sound). */
function land(state: WeaponCratesState, crate: WeaponCrate, cell: number): void {
  crate.y = Math.floor(crate.y / cell) * cell;
  crate.vy = 0;
  crate.grounded = true;
  crate.groundedSeconds = 0;
  state.landCount += 1;
}

/** Ages the crate; true while it still rests on terrain (the floor under it may be blasted away). */
function stillGrounded(args: StepWeaponCratesArgs, crate: WeaponCrate): boolean {
  const below = { ...crateBox(crate, args.tunables.combat.drops.size), y: crate.y, h: 1 };
  crate.ageSeconds += args.dt;
  if (crate.grounded && rectHitsSolid(args.terrain, below)) {
    crate.groundedSeconds += args.dt;
    return true;
  }
  crate.grounded = false;
  crate.groundedSeconds = 0;
  return false;
}

/** Falls in half-cell sub-steps; on contact lands on the cell row it entered. */
function fall(args: StepWeaponCratesArgs, crate: WeaponCrate): void {
  const { terrain, tunables, dt } = args;
  const size = tunables.combat.drops.size;
  const cell = terrain.cellSize;
  if (stillGrounded(args, crate)) return;
  crate.vy = fallSpeed(crate.vy, tunables.world, dt);
  const distance = crate.vy * dt;
  const steps = Math.max(1, Math.ceil(distance / (cell / 2)));
  for (let i = 0; i < steps; i += 1) {
    crate.y += distance / steps;
    if (!rectHitsSolid(terrain, crateBox(crate, size))) continue;
    land(args.crates, crate, cell);
    return;
  }
}

/** Advances drops, falls and pickups one step. Returns what spawned and who took what. */
export function stepWeaponCrates(args: StepWeaponCratesArgs): CrateStepResult {
  const result: CrateStepResult = { spawned: [], collected: [] };
  stepDropSchedule(args, result);
  const size = args.tunables.combat.drops.size;
  args.crates.list = args.crates.list.filter((crate) => {
    fall(args, crate);
    // Drop points may sit above the bounds top; only the bottom and sides remove a crate.
    const { x, w, y, h } = args.bounds;
    if (crate.y > y + h || crate.x < x || crate.x > x + w) return false;
    const player = firstToucher(crateBox(crate, size), args.players);
    if (!player) return true;
    result.collected.push({ itemId: crate.itemId, slot: player.slot });
    args.bursts.push({ id: crate.id, itemId: crate.itemId, x: crate.x, y: crate.y, ageSeconds: 0 });
    return false;
  });
  return result;
}
