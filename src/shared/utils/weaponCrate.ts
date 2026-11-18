/**
 * Proportions of a weapon crate (weapon-visuals-embellish D9, D10), as shares of the crate size:
 * the in-game Pixi crate (`collectibles/services/weaponCrateRenderer.ts`) and the lobby's SVG
 * crate toggles (`lobby/components/WeaponCrateIcon.tsx`) both draw from these, so the two stay the
 * same crate.
 */
export const WEAPON_CRATE_SHAPE = {
  /** Corner radius of the rounded box. */
  cornerRadius: 0.24,
  /** The mark tilts up like an aimed barrel (radians). */
  markTilt: -0.38,
  /** Mark scale: mockup units per crate size (the design page drew 0.9 on a 54-unit crate). */
  markUnits: 60,
  /** White outline around the mark. */
  markOutline: 0.054,
  /** Gloss oval on the upper left, like the blob's (DESIGN_LANGUAGE § 3); y from the bottom. */
  gloss: { x: -0.27, y: -0.76, rx: 0.065, ry: 0.11, tilt: (18 * Math.PI) / 180, alpha: 0.7 },
} as const;
