import type { GameTunables } from "@/shared/types/gameTunables.types";
import {
  respondToBodyContact,
  type BodyContact,
  type PlayerState,
} from "@/features/player/api/playerApi";
import type { DiveState } from "@/features/dive/types/dive.types";

/**
 * Dive hit reach (option A, dash-aim lap; on since the dive-reach lap). A headbutt normally lands
 * on a body contact: centres within one body width (28 units). With `dive.hitReach` above that, a
 * travelling dive also strikes a blob whose centre is within the reach before they touch: the
 * pair becomes a `BodyContact` and gets the body collision's own momentum exchange
 * (`respondToBodyContact`, velocities only), so a strike from 48 units plays out exactly like the
 * touch it replaces (a head-on clash still reflects both). Only pairs that will strike get one: a
 * dive gliding past without closing in shoves nobody. At or below the body width this adds
 * nothing (touch only), and without a travelling dive a bump is never touched by it.
 */
export interface ReachContactsArgs {
  dive: DiveState;
  players: readonly PlayerState[];
  /** This step's real body contacts: a pair already touching is not added twice. */
  contacts: readonly BodyContact[];
  tunables: GameTunables;
}

const centerY = (player: PlayerState): number => player.y - player.height / 2;

const travelling = (dive: DiveState, player: PlayerState): boolean =>
  dive.motions[player.id]?.phase === "travel";

const touching = (contacts: readonly BodyContact[], a: PlayerState, b: PlayerState): boolean =>
  contacts.some((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));

/** A contact for a pair whose centres are `distance` apart (a → b), before any response. */
function reachContact(a: PlayerState, b: PlayerState, distance: number): BodyContact {
  const normal = { x: (b.x - a.x) / distance, y: (centerY(b) - centerY(a)) / distance };
  return {
    a,
    b,
    normal,
    at: { x: (a.x + b.x) / 2, y: (centerY(a) + centerY(b)) / 2 },
    aApproachSpeed: a.vx * normal.x + a.vy * normal.y,
    bApproachSpeed: -(b.vx * normal.x + b.vy * normal.y),
    aImpulse: 0,
    bImpulse: 0,
  };
}

/** A travelling side closes in fast enough to strike (the dive's own hit test). */
function strikes(contact: BodyContact, args: ReachContactsArgs): boolean {
  const { dive, tunables } = args;
  const min = tunables.dive.minHitSpeed;
  return (
    (travelling(dive, contact.a) && contact.aApproachSpeed >= min) ||
    (travelling(dive, contact.b) && contact.bApproachSpeed >= min)
  );
}

/**
 * Pairs inside the dive hit reach that will strike and are not already touching, with the body
 * collision's momentum exchange applied to them. Mutates those players' velocities.
 */
export function resolveReachContacts(args: ReachContactsArgs): BodyContact[] {
  const { players, contacts, tunables } = args;
  const found: BodyContact[] = [];
  players.forEach((a, i) => {
    for (const b of players.slice(i + 1)) {
      if (!travelling(args.dive, a) && !travelling(args.dive, b)) continue;
      const distance = Math.hypot(b.x - a.x, centerY(b) - centerY(a));
      const touchDistance = (a.width + b.width) / 2;
      if (distance <= touchDistance || distance > tunables.dive.hitReach) continue;
      if (touching(contacts, a, b)) continue;
      const contact = reachContact(a, b, distance);
      if (strikes(contact, args)) found.push(contact);
    }
  });
  for (const contact of found) respondToBodyContact(contact, tunables.bodyCollision);
  return found;
}
