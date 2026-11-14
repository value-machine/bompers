import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncContactShadows, type ContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { WeaponCrate } from "@/features/collectibles/types/collectibles.types";

/**
 * Weapon-crate layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows): a cream crate with a sky ring
 * and a rocket mark (mockup variant E), and the contact shadow of a falling crate. Crates are
 * keyed by the outline step, so they rebuild only when the zoom-clamped width step changes.
 */
export interface CrateLayers {
  crates: Container;
  crateSprites: Map<string, Container>;
  shadows: ContactShadowLayer;
}

export interface CrateFrame {
  crates: readonly WeaponCrate[];
  size: number;
  /** Zoom-clamped prop outline. */
  outline: { width: number; step: number };
  /** Terrain the contact shadows fall on. */
  terrain: TerrainGrid;
}

/** Cream crate with a sky ring and a rocket mark; origin bottom-centre. */
function drawCrate(size: number, width: number): Container {
  const half = size / 2;
  return new Graphics()
    .roundRect(-half, -size, size, size, size * 0.24)
    .fill(GAME_PALETTE.pickupCrate)
    .stroke({ width, color: GAME_PALETTE.ink, join: "round" })
    .circle(0, -half, half * 0.62)
    .stroke({ width: size * 0.1, color: GAME_PALETTE.pickupRing })
    .roundRect(-half * 0.45, -half - size * 0.09, half * 0.9, size * 0.18, size * 0.09)
    .fill(GAME_PALETTE.ink);
}

/** Matches the crate and crate-shadow layers to the current crates. */
export function syncCrateLayers(layers: CrateLayers, frame: CrateFrame): void {
  const { crates, size, outline } = frame;
  syncDisplayById(layers.crateSprites, layers.crates, {
    list: crates,
    key: (crate) => `${crate.id}:${outline.step}`,
    create: () => drawCrate(size, outline.width),
    place: (sprite, crate) => sprite.position.set(crate.x, crate.y),
  });
  syncContactShadows(layers.shadows, {
    casters: crates
      .filter((crate) => !crate.grounded)
      .map((crate) => ({ key: `c${crate.id}`, x: crate.x, y: crate.y, width: size })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
}
