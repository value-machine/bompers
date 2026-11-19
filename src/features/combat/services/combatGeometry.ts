import type { Rect, Vec2 } from "@/shared/types/gameGeometry.types";
import { hurtHeight, type PlayerState } from "@/features/player/api/playerApi";

/** Geometry helpers shared by the combat systems. World units, y down. */

/** Centre of what hits see (the hurt box): lower while crouched (crouch-sink D4). */
export const bodyCenter = (player: PlayerState): Vec2 => ({
  x: player.x,
  y: player.y - hurtHeight(player) / 2,
});

/**
 * Helmet centre: where weapons fire from (GDD § 1). It sits 0.28 of the height above the body
 * centre and turns round it with the roll's spin, as drawn (spin-fire D3). A crouched blob's helmet
 * sinks with its hurt box (crouch-sink D4).
 */
export const helmetPoint = (player: PlayerState): Vec2 => {
  const rise = player.height * 0.28;
  const sunk = player.height - hurtHeight(player);
  return {
    x: player.x + rise * Math.sin(player.rollAngle),
    y: player.y - player.height / 2 - rise * Math.cos(player.rollAngle) + sunk,
  };
};

export const rectContains = (rect: Rect, point: Vec2, margin = 0): boolean =>
  point.x >= rect.x - margin &&
  point.x <= rect.x + rect.w + margin &&
  point.y >= rect.y - margin &&
  point.y <= rect.y + rect.h + margin;

/** Distance from a point to the nearest point of a rect (0 inside). */
export function distanceToRect(point: Vec2, rect: Rect): number {
  const nx = Math.max(rect.x, Math.min(point.x, rect.x + rect.w));
  const ny = Math.max(rect.y, Math.min(point.y, rect.y + rect.h));
  return Math.hypot(point.x - nx, point.y - ny);
}

/** Unit vector from `from` to `to`; `fallback` when the points coincide. */
export function unitBetween(from: Vec2, to: Vec2, fallback: Vec2): Vec2 {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length < 1e-6 ? fallback : { x: dx / length, y: dy / length };
}
