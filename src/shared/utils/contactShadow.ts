/**
 * Flat contact shadow under airborne things (DESIGN_LANGUAGE § 4): an ink ellipse on the first
 * surface below, shrinking and fading with height; none beyond 240 units.
 * Used by the player (`blobShadow`) and combat (pickups, rockets) layers.
 */
export const CONTACT_SHADOW_RANGE = 240;
const HEIGHT = 12;
const MAX_ALPHA = 0.28;

export interface ContactShadow {
  width: number;
  height: number;
  alpha: number;
}

/** Shadow size for something `bodyWidth` wide at `heightAboveGround`; null when out of range. */
export function contactShadow(heightAboveGround: number, bodyWidth: number): ContactShadow | null {
  if (heightAboveGround < 0 || heightAboveGround > CONTACT_SHADOW_RANGE) return null;
  const t = heightAboveGround / CONTACT_SHADOW_RANGE;
  return {
    width: 1.05 * bodyWidth * (1 - 0.5 * t),
    height: HEIGHT * (1 - 0.5 * t),
    alpha: MAX_ALPHA * (1 - t),
  };
}
