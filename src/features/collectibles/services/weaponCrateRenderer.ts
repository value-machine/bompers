import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { traceWeaponTube } from "@/shared/services/weaponTubeRenderer";
import { weaponTubeMark } from "@/shared/utils/weaponTube";
import { syncContactShadows, type ContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { WeaponCrate } from "@/features/collectibles/types/collectibles.types";

/**
 * Weapon-crate layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows, § 9 Weapon identity): a crate in
 * its weapon's accent showing the weapon's mouth, and the contact shadow of a falling crate.
 * Crates are keyed by item and outline step, so they rebuild only when the zoom-clamped width
 * step changes.
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

/** The mark tilts up like an aimed barrel. */
const MARK_TILT = -0.38;
/** Mark scale: mockup units per crate size (the design page drew 0.9 on a 54-unit crate). */
const MARK_UNITS = 60;
/** White outline around the mark, as a share of the crate size. */
const MARK_OUTLINE = 0.054;
/** Gloss oval on the upper left, like the blob's (DESIGN_LANGUAGE § 3): share of the crate size. */
const GLOSS = { x: -0.27, y: -0.76, rx: 0.065, ry: 0.11, tilt: (18 * Math.PI) / 180, alpha: 0.7 };

interface CrateLook {
  itemId: WeaponCrate["itemId"];
  size: number;
  width: number;
}

/**
 * Crate that shows what it holds (weapon-visuals-embellish D9, D10): the whole crate in the
 * weapon accent, the weapon's mouth centred on it in ink inside a white outline, and one white
 * gloss oval. Origin bottom-centre.
 */
function drawCrate({ itemId, size, width }: CrateLook): Container {
  const half = size / 2;
  const look = weaponLook(itemId);
  const crate = new Container();
  const box = new Graphics()
    .roundRect(-half, -size, size, size, size * 0.24)
    .fill(look.accent)
    .stroke({ width, color: GAME_PALETTE.ink, join: "round" });
  const gloss = new Graphics()
    .ellipse(0, 0, size * GLOSS.rx, size * GLOSS.ry)
    .fill({ color: GAME_PALETTE.gloss, alpha: GLOSS.alpha });
  gloss.position.set(size * GLOSS.x, size * GLOSS.y);
  gloss.rotation = GLOSS.tilt;
  const { parts, centre } = weaponTubeMark(look.tube, size / MARK_UNITS);
  // Two passes of the same shapes, like the blob's ink: white stroked wide underneath, ink on top.
  const mark = traceWeaponTube(new Graphics(), parts)
    .fill(GAME_PALETTE.crateMarkOutline)
    .stroke({
      width: size * MARK_OUTLINE * 2,
      color: GAME_PALETTE.crateMarkOutline,
      join: "round",
    });
  traceWeaponTube(mark, parts).fill(GAME_PALETTE.ink);
  mark.pivot.set(centre.x, centre.y);
  mark.position.set(0, -half);
  mark.rotation = MARK_TILT;
  crate.addChild(box, gloss, mark);
  return crate;
}

/** Matches the crate and crate-shadow layers to the current crates. */
export function syncCrateLayers(layers: CrateLayers, frame: CrateFrame): void {
  const { crates, size, outline } = frame;
  syncDisplayById(layers.crateSprites, layers.crates, {
    list: crates,
    key: (crate) => `${crate.id}:${crate.itemId}:${outline.step}`,
    create: (crate) => drawCrate({ itemId: crate.itemId, size, width: outline.width }),
    place: (sprite, crate) => sprite.position.set(crate.x, crate.y),
  });
  syncContactShadows(layers.shadows, {
    casters: crates
      .filter((crate) => !crate.grounded)
      .map((crate) => ({ key: `c${crate.id}`, x: crate.x, y: crate.y, width: size })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
}
