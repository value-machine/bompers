import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import {
  stepFallingBody,
  type FallingBody,
  type FallingContact,
  type SolidAt,
} from "@/shared/utils/fallingBody";
import { unposePoint } from "@/shared/utils/levelMotion";
import { moverDistanceAt, type MoverBody } from "@/features/arena/api/arenaApi";
import type { CombatEvent, CrushSqueeze } from "@/features/combat/api/combatApi";
import { PANIC_PUPIL_SCALE, reactToHit, type PlayerState } from "@/features/player/api/playerApi";
import type {
  GooDroplet,
  GooSplat,
  KnockoutPiece,
  KnockoutTunables,
} from "@/features/knockout/types/knockout.types";

/**
 * Knockout simulation (render-only; the game rules never read it). A `playerEliminated` event from
 * a hit starts a knockout:
 *   - the lethal hit ended exactly at 0 health → the blob flies with the hit's knockback in the
 *     shared roll (a copy of the victim stepped by the player controller, `roll` below) until its
 *     first hard contact (or `flungMaxSeconds`), then squashes;
 *   - overkill (the hit would have gone below 0) → it squashes on the spot, carrying the knockback.
 * After the squash it bursts: goo droplets leave with the blob's momentum plus a small spread and
 * become splats the instant they touch terrain; the helmet and the weapon tube fly off as solid
 * pieces until the victim respawns. Each burst is logged (`bursts`): the death sound plays on it.
 * Falling off the arena makes no knockout (it is off screen).
 * Droplets and pieces: `shared/utils/fallingBody`. Spreads are deterministic per event seq.
 */

/**
 * One knocked-out blob before it bursts. `flung`: rolling with the lethal hit's knockback;
 * `squash`: flattened in place for `squash.seconds`, then it bursts.
 */
export interface Knockout {
  /** The `playerEliminated` event's seq: keys every sprite this knockout makes. */
  key: number;
  victimId: string;
  slot: number;
  /** The victim's held weapon at the knockout (its tube flies off), or null. */
  itemId: WeaponItemId | null;
  /** `pancake`: crushed flat by a moving part, held, then straight to splats (moving-parts B3). */
  phase: "flung" | "squash" | "pancake";
  /** Seconds since the knockout started, and since the squash started. */
  age: number;
  squashAge: number;
  /** A copy of the victim, rolling in the shared roll (the sim no longer steps the victim). */
  body: PlayerState;
  /** Velocity the burst hands to the droplets and pieces. */
  carry: { vx: number; vy: number };
  /** A crush's squeeze (normal out of the part toward the victim, and which part). */
  squeeze?: CrushSqueeze;
}

/**
 * The crush look (owner, moving-parts B3 = R2A): the blob flattens against the part far past the
 * squash band (owner-approved) and holds 0.15 s, then turns straight into goo splats on both faces;
 * the part's splats ride with it, the other face's stay put.
 */
export const CRUSH_PANCAKE = {
  holdSeconds: 0.15,
  /** Body scale across and along the squeezed faces, and the panic pupils (owner, squish-eyes). */
  across: 0.22,
  along: 1.6,
  pupilScale: PANIC_PUPIL_SCALE,
  /** Splat offsets along each face (× R): on the part, then on the other face. */
  partOffsets: [-0.45, 0.35],
  wallOffsets: [-0.3, 0.5],
} as const;

/**
 * One blob bursting into goo: the splat moment the death sound plays on (death-splat-sound lap).
 * `n` counts the world's bursts from 1, in the order they happened.
 */
export interface KnockoutBurst {
  n: number;
  slot: number;
}

/** Bursts kept in the log: far more than can happen between two rendered frames. */
const BURST_LOG_SIZE = 16;

/** Everything the knockout layer simulates (render-only, never read by the game rules). */
export interface KnockoutWorld {
  /** Newest combat event seq already read. */
  lastSeq: number;
  knockouts: Knockout[];
  droplets: GooDroplet[];
  pieces: KnockoutPiece[];
  splats: GooSplat[];
  /** The newest bursts, oldest first (the sound reads them by `n`). */
  bursts: KnockoutBurst[];
}

/** A flying or squashing blob, for the player renderer to draw under its own id. */
export interface KnockoutBody {
  /** Sprite id, distinct from the victim's own (`ko-<key>`). */
  id: string;
  victimId: string;
  /** The rolling copy of the victim (position, velocity, roll spin). */
  player: PlayerState;
  /** 0 … 1 through the squash (0 while flying). */
  squash: number;
  /** Set while crushed flat: the squeeze direction (the pancake lies across it). */
  pancake?: { nx: number; ny: number };
}

export const createKnockoutWorld = (): KnockoutWorld => ({
  lastSeq: -1,
  knockouts: [],
  droplets: [],
  pieces: [],
  splats: [],
  bursts: [],
});

/** Logs a knockout's burst, trimming the log to `BURST_LOG_SIZE`. */
function logBurst(world: KnockoutWorld, knockout: Knockout): void {
  const n = (world.bursts[world.bursts.length - 1]?.n ?? 0) + 1;
  world.bursts = [...world.bursts, { n, slot: knockout.slot }].slice(-BURST_LOG_SIZE);
}

/** Body half-width R from the collision height (blobShapes' `blobMetrics`). */
const bodyRadius = (height: number): number => height / 2.3;
/** Body centre above the feet point, × R (feet tuck 9 mockup units under a 1 R body half). */
const CENTRE_LIFT = 1.3;
/** Helmet centre above the body centre, and the piece radii, × R. */
const HELMET_LIFT = 0.65;
const HELMET_RADIUS = 0.55;
const TUBE_RADIUS = 0.3;
/** Physics steps at most this long (the player sim's own step), so nothing skips a cell. */
const SUBSTEP_SECONDS = 1 / 120;
/** A droplet that never lands (it fell out of the arena) is dropped after this long. */
const DROPLET_MAX_SECONDS = 3;

/** Deterministic 0..1 noise from a seq and an index (the effects debris uses the same idea). */
const noise = (seq: number, i: number): number => {
  const x = Math.sin(seq * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const between = (min: number, max: number, t: number): number => min + (max - min) * t;

/** The burst's circle: the rolling copy's body centre, radius R, turned with its roll. */
function centreOf(knockout: Knockout): FallingBody {
  const { body } = knockout;
  const radius = bodyRadius(body.height);
  return {
    x: body.x,
    y: body.y - CENTRE_LIFT * radius,
    vx: body.vx,
    vy: body.vy,
    radius,
    angle: body.rollAngle,
    spin: 0,
  };
}

export interface NoteKnockoutsArgs {
  events: readonly CombatEvent[];
  victims: readonly PlayerState[];
  /** The weapon the victim held, if any (its tube flies off). */
  weaponOf: (playerId: string) => WeaponItemId | null;
  /** Game tunables: the roll the knockout starts in (`reactToHit`). */
  tunables: GameTunables;
}

type Eliminated = Extract<CombatEvent, { type: "playerEliminated" }>;

/** A crushed blob: flat where it was squeezed, no flight. */
function startPancake(event: Eliminated, victim: PlayerState, args: NoteKnockoutsArgs): Knockout {
  return {
    key: event.seq,
    victimId: victim.id,
    slot: victim.slot,
    itemId: args.weaponOf(victim.id),
    phase: "pancake",
    age: 0,
    squashAge: 0,
    body: { ...victim, x: event.x, y: event.y, vx: 0, vy: 0, rollAngle: 0 },
    carry: { vx: 0, vy: 0 },
    ...(event.squeeze && { squeeze: event.squeeze }),
  };
}

function startKnockout(event: Eliminated, victim: PlayerState, args: NoteKnockoutsArgs): Knockout {
  if (event.cause === "crush") return startPancake(event, victim, args);
  const body: PlayerState = { ...victim, x: event.x, y: event.y, vx: event.vx, vy: event.vy };
  // The lethal hit's knockback is the roll's impulse: the shared roll's hit reaction.
  reactToHit(body, { impulse: { x: event.vx, y: event.vy } }, args.tunables);
  return {
    key: event.seq,
    victimId: victim.id,
    slot: victim.slot,
    itemId: args.weaponOf(victim.id),
    phase: event.overkill ? "squash" : "flung",
    age: 0,
    squashAge: 0,
    body,
    carry: { vx: event.vx, vy: event.vy },
  };
}

/** Starts a knockout for every new elimination by a hit. Call once per rendered frame. */
export function noteKnockoutEvents(world: KnockoutWorld, args: NoteKnockoutsArgs): void {
  for (const event of args.events) {
    if (event.seq <= world.lastSeq) continue;
    world.lastSeq = event.seq;
    if (event.type !== "playerEliminated" || event.cause === "out-of-bounds") continue;
    const victim = args.victims.find((candidate) => candidate.slot === event.victimSlot);
    if (!victim) continue;
    world.knockouts.push(startKnockout(event, victim, args));
  }
}

export interface StepKnockoutsArgs {
  dt: number;
  gravity: number;
  solidAt: SolidAt;
  /**
   * Steps a flung knockout's copy of the victim by `dt` in the shared roll: the player
   * controller with no input (match passes `stepPlayers`). It reports terrain hits on the copy
   * (`terrainHitX/Y`, `terrainHitSpeedX/Y`).
   */
  roll: (body: PlayerState, dt: number) => void;
  /** The arena's moving parts (a crush's splats stick to the part that squeezed). */
  movers?: readonly MoverBody[];
  tunables: KnockoutTunables;
  /** The victim respawns this long after the knockout: its pieces vanish then. */
  respawnDelaySeconds: number;
}

/** How far behind a touch point a moving part is looked for, world units. */
const PART_PROBES = [2, 6, 12] as const;

type SubStep = StepKnockoutsArgs & { h: number };

const fall = (body: FallingBody, step: SubStep, bounce: number) =>
  stepFallingBody(body, {
    dt: step.h,
    gravity: step.gravity,
    solidAt: step.solidAt,
    bounce,
    friction: step.tunables.friction,
  });

/** The hardest terrain hit of the copy's last roll step, units / s (0 = none). */
const hitSpeed = (body: PlayerState): number =>
  Math.max(
    body.terrainHitX !== 0 ? body.terrainHitSpeedX : 0,
    body.terrainHitY !== 0 ? body.terrainHitSpeedY : 0
  );

/** Flight in the shared roll: the first hard contact (or the time limit) starts the squash. */
function fly(knockout: Knockout, step: SubStep): void {
  const { body } = knockout;
  const before = { vx: body.vx, vy: body.vy };
  step.roll(body, step.h);
  if (hitSpeed(body) >= step.tunables.hardContactSpeed) {
    knockout.phase = "squash";
    // Off a floor (a blocked move down) the goo skids on along it; into a wall or ceiling it
    // keeps going into it.
    const floor = body.terrainHitY === 1;
    knockout.carry = floor
      ? { vx: before.vx, vy: -Math.abs(before.vy) * step.tunables.bounce }
      : { ...before };
    return;
  }
  if (knockout.age >= step.tunables.flungMaxSeconds) {
    knockout.phase = "squash";
    knockout.carry = { vx: body.vx, vy: body.vy };
  }
}

function burstDroplets(world: KnockoutWorld, knockout: Knockout, tunables: KnockoutTunables) {
  const body = centreOf(knockout);
  const { carry, key } = knockout;
  const d = tunables.droplets;
  for (let i = 0; i < d.count; i += 1) {
    const turn = noise(key, i) * Math.PI * 2;
    const spread = between(d.minSpread, d.maxSpread, noise(key, i + 11));
    const radius = between(d.minRadius, d.maxRadius, noise(key, i + 23)) * body.radius;
    const dirX = Math.cos(turn);
    const dirY = Math.sin(turn);
    const droplet: GooDroplet = {
      key: `${key}:d${i}`,
      slot: knockout.slot,
      age: 0,
      body: {
        x: body.x + dirX * d.startOffset * body.radius,
        y: body.y + dirY * d.startOffset * body.radius,
        vx: carry.vx + dirX * spread,
        vy: carry.vy + dirY * spread,
        radius,
        angle: 0,
        spin: 0,
      },
    };
    world.droplets.push(droplet);
  }
}

function burstPieces(world: KnockoutWorld, knockout: Knockout, step: SubStep): void {
  const body = centreOf(knockout);
  const { carry, key } = knockout;
  const { piecePop, blinkSeconds } = step.tunables;
  const lifeSeconds = Math.max(blinkSeconds, step.respawnDelaySeconds - knockout.age);
  const piece = (
    kind: KnockoutPiece["kind"],
    at: { x: number; y: number },
    over: Partial<FallingBody>
  ) => {
    world.pieces.push({
      key: `${key}:${kind}`,
      kind,
      slot: knockout.slot,
      itemId: knockout.itemId,
      age: 0,
      lifeSeconds,
      body: { ...at, vx: 0, vy: 0, radius: body.radius, angle: body.angle, spin: 0, ...over },
    });
  };
  piece(
    "helmet",
    { x: body.x, y: body.y - HELMET_LIFT * body.radius },
    {
      radius: HELMET_RADIUS * body.radius,
      vx: carry.vx * 0.8 + (noise(key, 41) - 0.5) * 120,
      vy: carry.vy * 0.6 - piecePop,
      spin: (noise(key, 43) - 0.5) * 14,
    }
  );
  if (!knockout.itemId) return;
  const side = carry.vx >= 0 ? 1 : -1;
  piece(
    "tube",
    { x: body.x + side * 0.5 * body.radius, y: body.y - HELMET_LIFT * body.radius },
    {
      radius: TUBE_RADIUS * body.radius,
      vx: carry.vx * 0.9 + side * 100,
      vy: carry.vy * 0.6 - piecePop * 0.8,
      spin: (noise(key, 47) - 0.5) * 24,
    }
  );
}

/** A splat's surface normal snapped to the axis the splat shapes know. */
function axisNormal(nx: number, ny: number): { nx: -1 | 0 | 1; ny: -1 | 0 | 1 } {
  if (Math.abs(nx) >= Math.abs(ny)) return { nx: nx >= 0 ? 1 : -1, ny: 0 };
  return { nx: 0, ny: ny >= 0 ? 1 : -1 };
}

/**
 * The crush burst: splats on both squeezed faces, no droplets. Splats on the part are stored in
 * its rest pose and ride with it; the other face's stay where they landed.
 */
function burstPancake(world: KnockoutWorld, knockout: Knockout, step: SubStep): void {
  const { x, y, radius } = centreOf(knockout);
  const squeeze = knockout.squeeze ?? { nx: 1, ny: 0, mover: -1 };
  const length = Math.hypot(squeeze.nx, squeeze.ny) || 1;
  const n = { x: squeeze.nx / length, y: squeeze.ny / length };
  const along = { x: -n.y, y: n.x };
  const flat = CRUSH_PANCAKE.across * radius;
  const mover = step.movers?.[squeeze.mover];
  const splatRadius = step.tunables.droplets.maxRadius * radius;
  const add = (side: "part" | "wall", offset: number, i: number) => {
    const sign = side === "part" ? -1 : 1;
    const at = {
      x: x + n.x * sign * flat + along.x * offset * radius,
      y: y + n.y * sign * flat + along.y * offset * radius,
    };
    const normal = axisNormal(n.x * -sign, n.y * -sign);
    const onPart = side === "part" && mover;
    const rest = onPart ? unposePoint(mover.pose, mover.pivot, at) : at;
    world.splats.push({
      key: `${knockout.key}:c${i}`,
      slot: knockout.slot,
      x: rest.x,
      y: rest.y,
      ...normal,
      radius: splatRadius,
      age: 0,
      ...(onPart && { rides: { mover: squeeze.mover } }),
    });
  };
  CRUSH_PANCAKE.partOffsets.forEach((offset, i) => add("part", offset, i));
  CRUSH_PANCAKE.wallOffsets.forEach((offset, i) => add("wall", offset, i + 2));
}

/** A crushed blob holds flat for `holdSeconds`, then bursts into splats and pieces. */
function stepPancake(world: KnockoutWorld, knockout: Knockout, step: SubStep): boolean {
  knockout.squashAge += step.h;
  if (knockout.squashAge < CRUSH_PANCAKE.holdSeconds) return true;
  burstPancake(world, knockout, step);
  burstPieces(world, knockout, step);
  logBurst(world, knockout);
  return false;
}

/** Advances one knockout; true while it still has a body (false once it burst). */
function stepKnockout(world: KnockoutWorld, knockout: Knockout, step: SubStep): boolean {
  knockout.age += step.h;
  if (knockout.phase === "pancake") return stepPancake(world, knockout, step);
  if (knockout.phase === "flung") fly(knockout, step);
  if (knockout.phase !== "squash") return true;
  knockout.squashAge += step.h;
  if (knockout.squashAge < step.tunables.squash.seconds) return true;
  burstDroplets(world, knockout, step.tunables);
  burstPieces(world, knockout, step);
  logBurst(world, knockout);
  return false;
}

/**
 * The moving part a touch point is on, with the point in the part's rest pose; null on static
 * terrain. A fast droplet stops up to a step short of the surface, so the part is looked for at
 * a few depths behind the touch point.
 */
function partAt(movers: readonly MoverBody[] | undefined, contact: FallingContact) {
  const index =
    movers?.findIndex((mover) =>
      PART_PROBES.some(
        (depth) =>
          moverDistanceAt(mover, {
            x: contact.x - contact.nx * depth,
            y: contact.y - contact.ny * depth,
          }) > 0
      )
    ) ?? -1;
  const mover = movers?.[index];
  if (!mover) return null;
  return { mover: index, rest: unposePoint(mover.pose, mover.pivot, contact) };
}

/**
 * A droplet becomes a stain the instant it touches terrain (no bounce, no squish). On a moving
 * part the stain is stored in the part's rest pose and rides with it, like a crush's.
 */
function stepDroplet(world: KnockoutWorld, droplet: GooDroplet, step: SubStep): boolean {
  droplet.age += step.h;
  const contact = fall(droplet.body, step, 0);
  if (contact) {
    const part = partAt(step.movers, contact);
    world.splats.push({
      key: droplet.key,
      slot: droplet.slot,
      x: part ? part.rest.x : contact.x,
      y: part ? part.rest.y : contact.y,
      nx: contact.nx,
      ny: contact.ny,
      radius: droplet.body.radius,
      age: 0,
      ...(part && { rides: { mover: part.mover } }),
    });
    return false;
  }
  return droplet.age < DROPLET_MAX_SECONDS;
}

function stepPiece(piece: KnockoutPiece, step: SubStep): boolean {
  piece.age += step.h;
  fall(piece.body, step, step.tunables.bounce);
  return piece.age < piece.lifeSeconds;
}

/** Advances every knockout, droplet, piece and splat by `dt` seconds of render time. */
export function stepKnockouts(world: KnockoutWorld, args: StepKnockoutsArgs): void {
  const count = Math.max(1, Math.ceil(args.dt / SUBSTEP_SECONDS));
  const step: SubStep = { ...args, h: args.dt / count };
  for (let i = 0; i < count; i += 1) {
    world.knockouts = world.knockouts.filter((knockout) => stepKnockout(world, knockout, step));
    world.droplets = world.droplets.filter((droplet) => stepDroplet(world, droplet, step));
    world.pieces = world.pieces.filter((piece) => stepPiece(piece, step));
  }
  for (const splat of world.splats) splat.age += args.dt;
  world.splats = world.splats.filter((splat) => splat.age < args.tunables.splatSeconds);
}

/** The bodies still flying or squashing, for the player renderer to draw as blobs. */
export const knockoutBodies = (world: KnockoutWorld, tunables: KnockoutTunables): KnockoutBody[] =>
  world.knockouts.map(({ key, victimId, phase, squashAge, body, squeeze }) => ({
    id: `ko-${key}`,
    victimId,
    player: body,
    squash: phase === "squash" ? Math.min(1, squashAge / tunables.squash.seconds) : 0,
    ...(phase === "pancake" && { pancake: { nx: squeeze?.nx ?? 1, ny: squeeze?.ny ?? 0 } }),
  }));

/** Pieces blink at 8 Hz (like spawn protection) for their last `blinkSeconds`. */
export function pieceAlpha(piece: KnockoutPiece, blinkSeconds: number): number {
  if (piece.lifeSeconds - piece.age > blinkSeconds) return 1;
  return Math.floor(piece.age * 16) % 2 === 0 ? 1 : 0.2;
}
