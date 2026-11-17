import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import { stepFallingBody, type FallingBody, type SolidAt } from "@/shared/utils/fallingBody";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import type {
  GooDroplet,
  Knockout,
  KnockoutBody,
  KnockoutPiece,
  KnockoutTunables,
  KnockoutWorld,
} from "@/features/knockout/types/knockout.types";

/**
 * Knockout simulation (render-only; the game rules never read it). A `playerEliminated` event from
 * a hit starts a knockout:
 *   - the lethal hit ended exactly at 0 health → the blob flies with the hit's knockback until its
 *     first hard contact (or `flungMaxSeconds`), then squashes;
 *   - overkill (the hit would have gone below 0) → it squashes on the spot, carrying the knockback.
 * After the squash it bursts: goo droplets leave with the blob's momentum plus a small spread and
 * become splats the instant they touch terrain; the helmet and the weapon tube fly off as solid
 * pieces until the victim respawns. Falling off the arena makes no knockout (it is off screen).
 * Physics: `shared/utils/fallingBody`. Spreads are deterministic per event seq (no RNG in render).
 */
export const createKnockoutWorld = (): KnockoutWorld => ({
  lastSeq: -1,
  knockouts: [],
  droplets: [],
  pieces: [],
  splats: [],
});

/** Body half-width R from the collision height (blobShapes' `blobMetrics`). */
const bodyRadius = (height: number): number => height / 2.3;
/** Body centre above the feet point, × R (feet tuck 9 mockup units under a 1 R body half). */
const CENTRE_LIFT = 1.3;
/** Helmet centre above the body centre, and the piece radii, × R. */
const HELMET_LIFT = 0.65;
const HELMET_RADIUS = 0.55;
const TUBE_RADIUS = 0.3;
/** Physics steps at most this long, so fast droplets cannot skip a terrain cell. */
const SUBSTEP_SECONDS = 1 / 120;
/** A droplet that never lands (it fell out of the arena) is dropped after this long. */
const DROPLET_MAX_SECONDS = 3;

/** Deterministic 0..1 noise from a seq and an index (the effects debris uses the same idea). */
const noise = (seq: number, i: number): number => {
  const x = Math.sin(seq * 12.9898 + i * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
const between = (min: number, max: number, t: number): number => min + (max - min) * t;

/** The slice of a player a knockout needs (structural). */
export interface KnockoutVictim {
  id: string;
  slot: number;
  height: number;
}

export interface NoteKnockoutsArgs {
  events: readonly CombatEvent[];
  victims: readonly KnockoutVictim[];
  /** The weapon the victim held, if any (its tube flies off). */
  weaponOf: (playerId: string) => WeaponItemId | null;
}

type Eliminated = Extract<CombatEvent, { type: "playerEliminated" }>;

function startKnockout(event: Eliminated, victim: KnockoutVictim, itemId: WeaponItemId | null) {
  const radius = bodyRadius(victim.height);
  const body: FallingBody = {
    x: event.x,
    y: event.y - CENTRE_LIFT * radius,
    vx: event.vx,
    vy: event.vy,
    radius,
    angle: 0,
    spin: 0,
  };
  const knockout: Knockout = {
    key: event.seq,
    victimId: victim.id,
    slot: victim.slot,
    itemId,
    phase: event.overkill ? "squash" : "flung",
    age: 0,
    squashAge: 0,
    body,
    carry: { vx: event.vx, vy: event.vy },
  };
  return knockout;
}

/** Starts a knockout for every new elimination by a hit. Call once per rendered frame. */
export function noteKnockoutEvents(world: KnockoutWorld, args: NoteKnockoutsArgs): void {
  for (const event of args.events) {
    if (event.seq <= world.lastSeq) continue;
    world.lastSeq = event.seq;
    if (event.type !== "playerEliminated" || event.cause === "out-of-bounds") continue;
    const victim = args.victims.find((candidate) => candidate.slot === event.victimSlot);
    if (!victim) continue;
    world.knockouts.push(startKnockout(event, victim, args.weaponOf(victim.id)));
  }
}

export interface StepKnockoutsArgs {
  dt: number;
  gravity: number;
  solidAt: SolidAt;
  tunables: KnockoutTunables;
  /** The victim respawns this long after the knockout: its pieces vanish then. */
  respawnDelaySeconds: number;
}

type SubStep = StepKnockoutsArgs & { h: number };

const fall = (body: FallingBody, step: SubStep, bounce: number) =>
  stepFallingBody(body, {
    dt: step.h,
    gravity: step.gravity,
    solidAt: step.solidAt,
    bounce,
    friction: step.tunables.friction,
  });

/** Flight: the first hard contact (or the time limit) starts the squash. */
function fly(knockout: Knockout, step: SubStep): void {
  const { body } = knockout;
  const before = { vx: body.vx, vy: body.vy };
  const contact = fall(body, step, step.tunables.bounce);
  if (contact && contact.speed >= step.tunables.hardContactSpeed) {
    knockout.phase = "squash";
    // Off a floor the goo skids on along it; into a wall or ceiling it keeps going into it.
    knockout.carry =
      contact.ny < 0
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
  const { body, carry, key } = knockout;
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
  const { body, carry, key } = knockout;
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

/** Advances one knockout; true while it still has a body (false once it burst). */
function stepKnockout(world: KnockoutWorld, knockout: Knockout, step: SubStep): boolean {
  knockout.age += step.h;
  if (knockout.phase === "flung") fly(knockout, step);
  if (knockout.phase !== "squash") return true;
  knockout.squashAge += step.h;
  if (knockout.squashAge < step.tunables.squash.seconds) return true;
  burstDroplets(world, knockout, step.tunables);
  burstPieces(world, knockout, step);
  return false;
}

/** A droplet becomes a splat the instant it touches terrain (no bounce, no squish). */
function stepDroplet(world: KnockoutWorld, droplet: GooDroplet, step: SubStep): boolean {
  droplet.age += step.h;
  const contact = fall(droplet.body, step, 0);
  if (contact) {
    world.splats.push({
      key: droplet.key,
      slot: droplet.slot,
      x: contact.x,
      y: contact.y,
      nx: contact.nx,
      ny: contact.ny,
      radius: droplet.body.radius,
      age: 0,
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
  world.knockouts.map(({ key, victimId, phase, squashAge, body }) => ({
    id: `ko-${key}`,
    victimId,
    x: body.x,
    y: body.y + CENTRE_LIFT * body.radius,
    vx: body.vx,
    vy: body.vy,
    squash: phase === "squash" ? Math.min(1, squashAge / tunables.squash.seconds) : 0,
  }));

/** Pieces blink at 8 Hz (like spawn protection) for their last `blinkSeconds`. */
export function pieceAlpha(piece: KnockoutPiece, blinkSeconds: number): number {
  if (piece.lifeSeconds - piece.age > blinkSeconds) return 1;
  return Math.floor(piece.age * 16) % 2 === 0 ? 1 : 0.2;
}

/** Splats stay full until the respawn, then fade out by `splatSeconds`. */
export function splatAlpha(
  age: number,
  timing: { respawnDelaySeconds: number; splatSeconds: number }
): number {
  const { respawnDelaySeconds, splatSeconds } = timing;
  if (age <= respawnDelaySeconds) return 1;
  return Math.max(0, 1 - (age - respawnDelaySeconds) / (splatSeconds - respawnDelaySeconds));
}
