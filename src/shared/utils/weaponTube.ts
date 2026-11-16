/**
 * Helmet tube silhouettes per weapon (DESIGN_LANGUAGE § Weapon identity, weapon-visuals D1): the
 * shape of the tube is the weapon cue, so the blob, the crate face and later the HUD draw the same
 * geometry. Plain round rects along +x from the pivot, scaled by `u = r / 30`; the Pixi tracer is
 * `shared/services/weaponTubeRenderer.ts`. A new weapon adds its shape id and parts here and its
 * look (accent, shape id) in `gamePalette.weaponLooks`.
 *
 * Second copy (code-style § Naming F2): `features/player/services/blobShapes.ts` `tubePath` still
 * holds the capped tube until weapon-visuals phase 2 switches it to these parts.
 */
export type WeaponTubeShape = "capped";

export interface TubePart {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
}

export interface WeaponTubeParts {
  parts: readonly TubePart[];
  /** Centre of the muzzle cap, where the ready light sits. */
  muzzle: { x: number; y: number };
}

/** The tube of `shape` at scale `u`. */
export function weaponTubeParts(shape: WeaponTubeShape, u: number): WeaponTubeParts {
  switch (shape) {
    case "capped":
      // Rocket launcher: tube 26 × 14 with its cap 8 × 16 (DESIGN_LANGUAGE § 2).
      return {
        parts: [
          { x: -3 * u, y: -7 * u, width: 26 * u, height: 14 * u, radius: 6 * u },
          { x: 17 * u, y: -8 * u, width: 8 * u, height: 16 * u, radius: 3.5 * u },
        ],
        muzzle: { x: 21 * u, y: 0 },
      };
  }
}
