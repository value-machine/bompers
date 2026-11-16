import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { traceWeaponTube } from "@/shared/services/weaponTubeRenderer";
import { weaponTubeParts } from "@/shared/utils/weaponTube";
import { syncContactShadows, type ContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { WeaponCrate } from "@/features/collectibles/types/collectibles.types";

/**
 * Weapon-crate layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows, § Weapon identity): a cream
 * crate showing its weapon's tube in an accent ring, and the contact shadow of a falling crate. Crates are
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

/** Tube length in `u` (capped tube spans x −3…25) and its centre, to fit the mark in the ring. */
const TUBE_SPAN = 28;
const TUBE_CENTRE = 11;
/** The mark tilts up like an aimed tube. */
const MARK_TILT = -0.38;

/**
 * Cream crate whose face shows what it holds (weapon-visuals D1): the weapon's tube silhouette
 * in ink inside a ring in the weapon accent. Origin bottom-centre.
 */
function drawCrate(size: number, width: number, itemId: string): Container {
  const half = size / 2;
  const look = weaponLook(itemId);
  const ringRadius = half * 0.62;
  const crate = new Container();
  const box = new Graphics()
    .roundRect(-half, -size, size, size, size * 0.24)
    .fill(GAME_PALETTE.pickupCrate)
    .stroke({ width, color: GAME_PALETTE.ink, join: "round" })
    .circle(0, -half, ringRadius)
    .stroke({ width: size * 0.1, color: look.accent });
  const u = (ringRadius * 1.5) / TUBE_SPAN;
  const mark = traceWeaponTube(new Graphics(), weaponTubeParts(look.tube, u)).fill(
    GAME_PALETTE.ink
  );
  mark.pivot.set(TUBE_CENTRE * u, 0);
  mark.position.set(0, -half);
  mark.rotation = MARK_TILT;
  crate.addChild(box, mark);
  return crate;
}

/** Matches the crate and crate-shadow layers to the current crates. */
export function syncCrateLayers(layers: CrateLayers, frame: CrateFrame): void {
  const { crates, size, outline } = frame;
  syncDisplayById(layers.crateSprites, layers.crates, {
    list: crates,
    key: (crate) => `${crate.id}:${crate.itemId}:${outline.step}`,
    create: (crate) => drawCrate(size, outline.width, crate.itemId),
    place: (sprite, crate) => sprite.position.set(crate.x, crate.y),
  });
  syncContactShadows(layers.shadows, {
    casters: crates
      .filter((crate) => !crate.grounded)
      .map((crate) => ({ key: `c${crate.id}`, x: crate.x, y: crate.y, width: size })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
}
