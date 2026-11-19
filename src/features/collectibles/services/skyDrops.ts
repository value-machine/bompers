import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { Rect } from "@/shared/types/gameGeometry.types";
import { hurtBox, type PlayerState } from "@/features/player/api/playerApi";

/**
 * Mechanics every sky drop shares (point orbs, weapon crates): the deterministic drop timer
 * (no randomness in the sim, combat D6), falling with the match gravity, and touch pickup.
 */
export interface DropSchedule {
  intervalSeconds: number;
  /** No new drop while this many are in the arena. */
  maxActive: number;
}

export interface DropTimerArgs {
  schedule: DropSchedule;
  /** How many of this kind are in the arena now. */
  active: number;
  dt: number;
}

/**
 * Counts a drop timer down one step. When it runs out it restarts at `intervalSeconds`, and a
 * drop is due if fewer than `maxActive` are in the arena.
 */
export function tickDropTimer(timer: number, args: DropTimerArgs): { timer: number; due: boolean } {
  const next = timer - args.dt;
  if (next > 0) return { timer: next, due: false };
  return { timer: args.schedule.intervalSeconds, due: args.active < args.schedule.maxActive };
}

/** Fall speed after one step of the match gravity, capped at the world's max fall speed. */
export const fallSpeed = (vy: number, world: GameTunables["world"], dt: number): number =>
  Math.min(world.maxFallSpeed, vy + world.gravity * dt);

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

/** The first of `players` whose hurt box (lower while crouched, crouch-sink D6) touches `box` (they take the drop), or undefined. */
export const firstToucher = (box: Rect, players: readonly PlayerState[]): PlayerState | undefined =>
  players.find((player) => overlaps(box, hurtBox(player)));
