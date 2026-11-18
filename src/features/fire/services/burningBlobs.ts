import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { PlayerInputs } from "@/shared/types/gameInput.types";
import type { Vec2 } from "@/shared/types/gameGeometry.types";
import {
  EMPTY_CELL,
  bodyGrids,
  bodyWorldPoint,
  terrainBodies,
  type TerrainGrid,
} from "@/features/arena/api/arenaApi";
import type { BodyContact, PlayerState } from "@/features/player/api/playerApi";
import type { BlobFireMoment, FireState } from "@/features/fire/types/fire.types";

/**
 * Blobs on fire (fire-burn b2; owner blast-power D7, fire-burn D1–D6). A blob catches from a
 * burning terrain sample within its body radius plus one sample, or from a torch ray that reaches
 * it (`sprayTorch` calls `catchFire`). It loses a chunk `fire.blob.firstTickSeconds` in and, at
 * `fire.blob.burnSeconds`, a second one unless it is crouching then, and goes out (owner D10; the
 * match applies each through combat's `applyHit`). Before that, ice next to the
 * body puts it out (steam), starting a dive blows the flames off, and bumping a rival passes the
 * fire on: the rival starts its own full burn and the bumper goes out. A blob just put out can't
 * catch for `fire.blob.graceSeconds`, so a bump never passes the fire straight back.
 * Control is unchanged while burning; only with no move input does `panicInputs` run it away.
 */

const bodyCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - player.height / 2,
});

export const isBurning = (fire: FireState, player: PlayerState): boolean =>
  fire.blobs.has(player.id);

export interface CatchFireArgs {
  now: number;
  /** World x the fire came from (the blob flees the other way). */
  fromX: number;
  bySlot: number | null;
}

/** Sets a blob on fire; false when it is already burning or was just put out. */
export function catchFire(fire: FireState, player: PlayerState, args: CatchFireArgs): boolean {
  if (fire.blobs.has(player.id)) return false;
  if (args.now < (fire.blobGraceUntil.get(player.id) ?? -Infinity)) return false;
  fire.blobs.set(player.id, {
    slot: player.slot,
    since: args.now,
    fromX: args.fromX,
    bySlot: args.bySlot,
    ticks: 0,
  });
  fire.caughtCounts[player.id] = (fire.caughtCounts[player.id] ?? 0) + 1;
  addMoment(fire, {
    kind: "caught",
    slot: player.slot,
    at: bodyCenter(player),
    atSeconds: args.now,
  });
  return true;
}

function addMoment(fire: FireState, moment: BlobFireMoment): void {
  fire.blobMoments.push(moment);
}

interface PutOut {
  kind: BlobFireMoment["kind"];
  now: number;
  tunables: GameTunables;
  to?: Vec2;
}

function putOut(fire: FireState, player: PlayerState, how: PutOut): void {
  fire.blobs.delete(player.id);
  fire.blobGraceUntil.set(player.id, how.now + how.tunables.fire.blob.graceSeconds);
  const moment: BlobFireMoment = {
    kind: how.kind,
    slot: player.slot,
    at: bodyCenter(player),
    atSeconds: how.now,
  };
  if (how.to) moment.to = how.to;
  addMoment(fire, moment);
}

/**
 * Ice puts a burning blob out with steam: ice terrain next to it, or ice on the blob itself
 * (the match calls this for a freeze ray's chill, ice-frozen-blobs D6). False when it wasn't
 * burning.
 */
export function douseBlob(
  fire: FireState,
  player: PlayerState,
  at: { now: number; tunables: GameTunables }
): boolean {
  if (!fire.blobs.has(player.id)) return false;
  fire.dousedCounts[player.id] = (fire.dousedCounts[player.id] ?? 0) + 1;
  putOut(fire, player, { kind: "steam", now: at.now, tunables: at.tunables });
  return true;
}

/**
 * Calls `visit` for every solid sample of `grid` within `reach` of `center` (a point in the
 * grid's own coordinates) until it returns true.
 */
function someSampleNear(
  grid: TerrainGrid,
  near: { center: Vec2; reach: number },
  visit: (index: number, center: Vec2) => boolean
): boolean {
  const c = near.center;
  const size = grid.cellSize;
  const minX = Math.max(0, Math.floor((c.x - near.reach) / size));
  const maxX = Math.min(grid.widthCells - 1, Math.floor((c.x + near.reach) / size));
  const minY = Math.max(0, Math.floor((c.y - near.reach) / size));
  const maxY = Math.min(grid.heightCells - 1, Math.floor((c.y + near.reach) / size));
  for (let cy = minY; cy <= maxY; cy += 1) {
    for (let cx = minX; cx <= maxX; cx += 1) {
      const index = cy * grid.widthCells + cx;
      if ((grid.cells[index] ?? EMPTY_CELL) === EMPTY_CELL) continue;
      const center = { x: (cx + 0.5) * size, y: (cy + 0.5) * size };
      if (Math.hypot(center.x - c.x, center.y - c.y) > near.reach) continue;
      if (visit(index, center)) return true;
    }
  }
  return false;
}

const reachOf = (grid: TerrainGrid, player: PlayerState): number =>
  player.width / 2 + grid.cellSize;

export interface StepBurningBlobsArgs {
  terrain: TerrainGrid;
  /** Players in play; a burning blob that left play (eliminated, waiting) just goes out. */
  players: readonly PlayerState[];
  /** This step's blob-vs-blob contacts (a bump passes the fire). */
  contacts: readonly BodyContact[];
  /** Whether a blob is winding up or travelling in a dive (blows its flames off). */
  isDiving: (player: PlayerState) => boolean;
  now: number;
  tunables: GameTunables;
}

/** A burn damage tick this step: the match takes one chunk (`hitDamage.burn`). */
export interface BurnDown {
  player: PlayerState;
  bySlot: number | null;
  at: Vec2;
}

/** Ice next to the body or a dive puts a burning blob out. */
function douseBurning(fire: FireState, args: StepBurningBlobsArgs): void {
  const { terrain, now, tunables } = args;
  for (const player of args.players) {
    if (!fire.blobs.has(player.id)) continue;
    const near = { center: bodyCenter(player), reach: reachOf(terrain, player) };
    const iced = someSampleNear(
      terrain,
      near,
      (index) => terrain.slots[terrain.cells[index] ?? EMPTY_CELL]?.douses === true
    );
    if (iced) {
      douseBlob(fire, player, { now, tunables });
    } else if (args.isDiving(player)) {
      putOut(fire, player, { kind: "blown", now, tunables });
    }
  }
}

/**
 * A blob touching a burning sample of any body (the ground or a moving part) catches; the fire
 * came from that sample. A part is searched in its own frame, around the blob's centre there.
 */
function catchFromTerrain(fire: FireState, args: StepBurningBlobsArgs): void {
  const { terrain, now } = args;
  const bodies = terrainBodies(terrain);
  const grids = bodyGrids(terrain);
  for (const player of args.players) {
    const world = bodyCenter(player);
    const reach = reachOf(terrain, player);
    bodies.some(({ toLocal }, body) => {
      const ground = fire.grounds[body];
      const grid = grids[body];
      const center = toLocal ? toLocal(world) : world;
      if (!ground || !grid || !center || fire.blobs.has(player.id)) return false;
      return someSampleNear(grid, { center, reach }, (index, at) => {
        if ((ground.igniteAt[index] ?? Infinity) > now) return false;
        const fromX = bodyWorldPoint(terrain, body, at).x;
        return catchFire(fire, player, { now, fromX, bySlot: null });
      });
    });
  }
}

/** A bump between a burning blob and one that isn't passes the fire across. */
function passOnBump(fire: FireState, args: StepBurningBlobsArgs): void {
  const { now, tunables } = args;
  for (const contact of args.contacts) {
    const aBurns = fire.blobs.has(contact.a.id);
    if (aBurns === fire.blobs.has(contact.b.id)) continue;
    const [from, to] = aBurns ? [contact.a, contact.b] : [contact.b, contact.a];
    // Passing it on makes the passer the one who lit the rival (credit for the chunk, D5).
    if (!catchFire(fire, to, { now, fromX: from.x, bySlot: from.slot })) continue;
    putOut(fire, from, { kind: "leap", now, tunables, to: bodyCenter(to) });
  }
}

/**
 * Burn damage over time (owner fire-burn D10): a first chunk `firstTickSeconds` into the burn,
 * then at `burnSeconds` the blob goes out with a second chunk, skipped when it is crouching then.
 */
function burnDown(fire: FireState, args: StepBurningBlobsArgs): BurnDown[] {
  const { now, tunables } = args;
  const { firstTickSeconds, burnSeconds } = tunables.fire.blob;
  const downs: BurnDown[] = [];
  for (const player of args.players) {
    const burning = fire.blobs.get(player.id);
    if (!burning) continue;
    const burnt = now - burning.since;
    const chunk = { player, bySlot: burning.bySlot, at: bodyCenter(player) };
    if (burning.ticks === 0 && burnt >= firstTickSeconds) {
      burning.ticks = 1;
      downs.push(chunk);
    }
    if (burnt < burnSeconds) continue;
    if (!player.crouching) downs.push(chunk);
    putOut(fire, player, { kind: "smoke", now, tunables });
  }
  return downs;
}

/**
 * One step of burning blobs, after the terrain fire and the torch: put out, catch from terrain,
 * pass on bumps, burn down. Returns the blobs that burnt down this step.
 */
export function stepBurningBlobs(fire: FireState, args: StepBurningBlobsArgs): BurnDown[] {
  const inPlay = new Set(args.players.map((player) => player.id));
  for (const id of [...fire.blobs.keys()]) if (!inPlay.has(id)) fire.blobs.delete(id);
  const keepFrom = args.now - args.tunables.fire.blob.momentSeconds;
  fire.blobMoments = fire.blobMoments.filter((moment) => moment.atSeconds >= keepFrom);
  douseBurning(fire, args);
  catchFromTerrain(fire, args);
  passOnBump(fire, args);
  return burnDown(fire, args);
}

/**
 * Panic flee (owner fire-burn D2): a burning blob with no move input runs away from where its fire
 * came from at full run speed, as if the player held that way, so it runs off ledges too. Any
 * move or crouch input keeps full control (D3).
 */
export function panicInputs(
  fire: FireState,
  players: readonly PlayerState[],
  inputs: PlayerInputs
): PlayerInputs {
  if (fire.blobs.size === 0) return inputs;
  return inputs.map((input, slot) => {
    if (input.moveX !== 0 || input.crouch) return input;
    const player = players.find((candidate) => candidate.slot === slot);
    const burning = player ? fire.blobs.get(player.id) : undefined;
    if (!player || !burning) return input;
    const away = player.x === burning.fromX ? -player.facing : Math.sign(player.x - burning.fromX);
    return { ...input, moveX: away };
  });
}
