/**
 * A row of equal pills spread over a fixed width, the first `filled` of them full: the HUD's
 * health chunks and the weapon ammo row (DESIGN_LANGUAGE § 7, weapon-visuals D3) share this
 * layout so both rows line up. Pure layout; the HUD renderer draws and colours the pills.
 */
export interface Pill {
  x: number;
  w: number;
  filled: boolean;
}

export interface PillRowInput {
  /** Pills in the row (max health, ammo capacity). */
  count: number;
  /** How many from the left are full (health left, shots left). */
  filled: number;
  /** Row width, from x 0. */
  width: number;
  gap: number;
}

/** Pills from x 0 to `width`. */
export function pillRow({ count, filled, width, gap }: PillRowInput): Pill[] {
  if (count <= 0) return [];
  const w = (width - gap * (count - 1)) / count;
  return Array.from({ length: count }, (_, i) => ({ x: i * (w + gap), w, filled: i < filled }));
}
