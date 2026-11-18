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
import type { FireState } from "@/features/fire/api/fireApi";
import type { BlobFireMoment, BlobFireState } from "@/features/blob-fire/types/blobFire.types";

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

/** Fresh state: nothing burns. */
export const createBlobFireState = (): BlobFireState => ({
  blobs: new Map(),
  blobGraceUntil: new Map(),
  blobMoments: [],
  caughtCounts: {},
  dousedCounts: {},
});

export const isBurning = (blobFire: BlobFireState, player: PlayerState): boolean =>
  blobFire.blobs.has(player.id);

export interface CatchFireArgs {
  now: number;
  /** World x the fire came from (the blob flees the other way). */
  fromX: number;
  bySlot: number | null;
}

/** Sets a blob on fire; false when it is already burning or was just put out. */
export function catchFire(
  blobFire: BlobFireState,
  player: PlayerState,
  args: CatchFireArgs
): boolean {
  if (blobFire.blobs.has(player.id)) return false;
  if (args.now < (blobFire.blobGraceUntil.get(player.id) ?? -Infinity)) return false;
  blobFire.blobs.set(player.id, {
    slot: player.slot,
    since: args.now,
    fromX: args.fromX,
    bySlot: args.bySlot,
    ticks: 0,
  });
  blobFire.caughtCounts[player.id] = (blobFire.caughtCounts[player.id] ?? 0) + 1;
  addMoment(blobFire, {
    kind: "caught",
    slot: player.slot,
    at: bodyCenter(player),
    atSeconds: args.now,
  });
  return true;
}

function addMoment(blobFire: BlobFireState, moment: BlobFireMoment): void {
  blobFire.blobMoments.push(moment);
}

interface PutOut {
  kind: BlobFireMoment["kind"];
  now: number;
  tunables: GameTunables;
  to?: Vec2;
}

function putOut(blobFire: BlobFireState, player: PlayerState, how: PutOut): void {
  blobFire.blobs.delete(player.id);
  blobFire.blobGraceUntil.set(player.id, how.now + how.tunables.fire.blob.graceSeconds);
  const moment: BlobFireMoment = {
    kind: how.kind,
    slot: player.slot,
    at: bodyCenter(player),
    atSeconds: how.now,
  };
  if (how.to) moment.to = how.to;
  addMoment(blobFire, moment);
}

/**
 * Ice puts a burning blob out with steam: ice terrain next to it, or ice on the blob itself
 * (the match calls this for a freeze ray's chill, ice-frozen-blobs D6). False when it wasn't
 * burning.
 */
export function douseBlob(
  blobFire: BlobFireState,
  player: PlayerState,
  at: { now: number; tunables: GameTunables }
): boolean {
  if (!blobFire.blobs.has(player.id)) return false;
  blobFire.dousedCounts[player.id] = (blobFire.dousedCounts[player.id] ?? 0) + 1;
  putOut(blobFire, player, { kind: "steam", now: at.now, tunables: at.tunables });
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
  /** The fire on the arena's bodies: a blob touching a burning sample catches. */
  fire: FireState;
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
function douseBurning(blobFire: BlobFireState, args: StepBurningBlobsArgs): void {
  const { terrain, now, tunables } = args;
  for (const player of args.players) {
    if (!blobFire.blobs.has(player.id)) continue;
    const near = { center: bodyCenter(player), reach: reachOf(terrain, player) };
    const iced = someSampleNear(
      terrain,
      near,
      (index) => terrain.slots[terrain.cells[index] ?? EMPTY_CELL]?.douses === true
    );
    if (iced) {
      douseBlob(blobFire, player, { now, tunables });
    } else if (args.isDiving(player)) {
      putOut(blobFire, player, { kind: "blown", now, tunables });
    }
  }
}

/**
 * A blob touching a burning sample of any body (the ground or a moving part) catches; the fire
 * came from that sample. A part is searched in its own frame, around the blob's centre there.
 */
function catchFromTerrain(blobFire: BlobFireState, args: StepBurningBlobsArgs): void {
  const { terrain, now } = args;
  const bodies = terrainBodies(terrain);
  const grids = bodyGrids(terrain);
  for (const player of args.players) {
    const world = bodyCenter(player);
    const reach = reachOf(terrain, player);
    bodies.some(({ toLocal }, body) => {
      const ground = args.fire.grounds[body];
      const grid = grids[body];
      const center = toLocal ? toLocal(world) : world;
      if (!ground || !grid || !center || blobFire.blobs.has(player.id)) return false;
      return someSampleNear(grid, { center, reach }, (index, at) => {
        if ((ground.igniteAt[index] ?? Infinity) > now) return false;
        const fromX = bodyWorldPoint(terrain, body, at).x;
        return catchFire(blobFire, player, { now, fromX, bySlot: null });
      });
    });
  }
}

/** A bump between a burning blob and one that isn't passes the fire across. */
function passOnBump(blobFire: BlobFireState, args: StepBurningBlobsArgs): void {
  const { now, tunables } = args;
  for (const contact of args.contacts) {
    const aBurns = blobFire.blobs.has(contact.a.id);
    if (aBurns === blobFire.blobs.has(contact.b.id)) continue;
    const [from, to] = aBurns ? [contact.a, contact.b] : [contact.b, contact.a];
    // Passing it on makes the passer the one who lit the rival (credit for the chunk, D5).
    if (!catchFire(blobFire, to, { now, fromX: from.x, bySlot: from.slot })) continue;
    putOut(blobFire, from, { kind: "leap", now, tunables, to: bodyCenter(to) });
  }
}

/**
 * Burn damage over time (owner fire-burn D10): a first chunk `firstTickSeconds` into the burn,
 * then at `burnSeconds` the blob goes out with a second chunk, skipped when it is crouching then.
 */
function burnDown(blobFire: BlobFireState, args: StepBurningBlobsArgs): BurnDown[] {
  const { now, tunables } = args;
  const { firstTickSeconds, burnSeconds } = tunables.fire.blob;
  const downs: BurnDown[] = [];
  for (const player of args.players) {
    const burning = blobFire.blobs.get(player.id);
    if (!burning) continue;
    const burnt = now - burning.since;
    const chunk = { player, bySlot: burning.bySlot, at: bodyCenter(player) };
    if (burning.ticks === 0 && burnt >= firstTickSeconds) {
      burning.ticks = 1;
      downs.push(chunk);
    }
    if (burnt < burnSeconds) continue;
    if (!player.crouching) downs.push(chunk);
    putOut(blobFire, player, { kind: "smoke", now, tunables });
  }
  return downs;
}

/**
 * One step of burning blobs, after the terrain fire and the torch: put out, catch from terrain,
 * pass on bumps, burn down. Returns the blobs that burnt down this step.
 */
export function stepBurningBlobs(blobFire: BlobFireState, args: StepBurningBlobsArgs): BurnDown[] {
  const inPlay = new Set(args.players.map((player) => player.id));
  for (const id of [...blobFire.blobs.keys()]) if (!inPlay.has(id)) blobFire.blobs.delete(id);
  const keepFrom = args.now - args.tunables.fire.blob.momentSeconds;
  blobFire.blobMoments = blobFire.blobMoments.filter((moment) => moment.atSeconds >= keepFrom);
  douseBurning(blobFire, args);
  catchFromTerrain(blobFire, args);
  passOnBump(blobFire, args);
  return burnDown(blobFire, args);
}

/**
 * Panic flee (owner fire-burn D2): a burning blob with no move input runs away from where its fire
 * came from at full run speed, as if the player held that way, so it runs off ledges too. Any
 * move or crouch input keeps full control (D3).
 */
export function panicInputs(
  blobFire: BlobFireState,
  players: readonly PlayerState[],
  inputs: PlayerInputs
): PlayerInputs {
  if (blobFire.blobs.size === 0) return inputs;
  return inputs.map((input, slot) => {
    if (input.moveX !== 0 || input.crouch) return input;
    const player = players.find((candidate) => candidate.slot === slot);
    const blob = player ? blobFire.blobs.get(player.id) : undefined;
    if (!player || !blob) return input;
    const away = player.x === blob.fromX ? -player.facing : Math.sign(player.x - blob.fromX);
    return { ...input, moveX: away };
  });
}
