import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";
import type { FallingBody } from "@/shared/types/fallingBody.types";

export type KnockoutTunables = GameTunables["feel"]["knockout"];

/**
 * One knocked-out blob before it bursts. `flung`: flying with the lethal hit's knockback;
 * `squash`: flattened in place for `squash.seconds`, then it bursts.
 */
export interface Knockout {
  /** The `playerEliminated` event's seq: keys every sprite this knockout makes. */
  key: number;
  victimId: string;
  slot: number;
  /** The victim's held weapon at the knockout (its tube flies off), or null. */
  itemId: WeaponItemId | null;
  phase: "flung" | "squash";
  /** Seconds since the knockout started, and since the squash started. */
  age: number;
  squashAge: number;
  /** The body as a circle around the body centre (radius R). */
  body: FallingBody;
  /** Velocity the burst hands to the droplets and pieces. */
  carry: { vx: number; vy: number };
}

/** A goo droplet in flight; it turns into a splat the instant it touches terrain. */
export interface GooDroplet {
  key: string;
  slot: number;
  body: FallingBody;
  age: number;
}

/** The helmet or the weapon tube, flying off as a solid piece until the respawn. */
export interface KnockoutPiece {
  key: string;
  kind: "helmet" | "tube";
  slot: number;
  itemId: WeaponItemId | null;
  body: FallingBody;
  age: number;
  /** Age at which it vanishes (the victim's respawn). */
  lifeSeconds: number;
}

/** A goo stain on terrain where a droplet landed. Normal points out of the surface. */
export interface GooSplat {
  key: string;
  slot: number;
  x: number;
  y: number;
  nx: -1 | 0 | 1;
  ny: -1 | 0 | 1;
  /** The droplet's radius (the splat's size scales with it). */
  radius: number;
  age: number;
}

/** Everything the knockout layer simulates (render-only, never read by the game rules). */
export interface KnockoutWorld {
  /** Newest combat event seq already read. */
  lastSeq: number;
  knockouts: Knockout[];
  droplets: GooDroplet[];
  pieces: KnockoutPiece[];
  splats: GooSplat[];
}

/** A flying or squashing body, for the player renderer to draw as a blob. */
export interface KnockoutBody {
  /** Sprite id, distinct from the victim's own (`ko-<key>`). */
  id: string;
  victimId: string;
  /** Feet point (the player renderer's origin) and velocity. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 0 … 1 through the squash (0 while flying). */
  squash: number;
}
