import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { BodyContact, PlayerState } from "@/features/player/api/playerApi";
import type { DiveState } from "@/features/dive/types/dive.types";

/**
 * Dash hit reach (option A, dash-aim lap; owner: "try B first, then the bigger hit box, or
 * both"). A headbutt normally lands on a body contact: centres within one body width (28 units).
 * With `dive.hitReach` above that, a travelling dasher also strikes a blob whose centre is within
 * the reach without touching it. Each such pair becomes a `BodyContact` with no momentum exchange
 * (nothing collided), so the strike's own push is the whole knockback. At or below the body width
 * this adds nothing: today's touch-only hits. Pure; the dive sim calls it once per step.
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

/** A contact for a pair whose centres are `distance` apart along `normal` (a → b). */
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

/** Pairs within the dash hit reach (one of them travelling) that are not already touching. */
export function reachContacts(args: ReachContactsArgs): BodyContact[] {
  const { dive, players, contacts, tunables } = args;
  const reach = tunables.dive.hitReach;
  const found: BodyContact[] = [];
  players.forEach((a, i) => {
    for (const b of players.slice(i + 1)) {
      if (!travelling(dive, a) && !travelling(dive, b)) continue;
      const distance = Math.hypot(b.x - a.x, centerY(b) - centerY(a));
      const touchDistance = (a.width + b.width) / 2;
      if (distance <= touchDistance || distance > reach) continue;
      if (!touching(contacts, a, b)) found.push(reachContact(a, b, distance));
    }
  });
  return found;
}
