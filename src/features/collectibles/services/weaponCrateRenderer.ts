import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncContactShadows, type ContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { WeaponCrate } from "@/features/collectibles/types/collectibles.types";

/**
 * Weapon-crate layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows): a cream crate whose ring and
 * mark show the weapon (mockup variant E), and the contact shadow of a falling crate. Crates are
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

interface CrateLook {
  itemId: WeaponCrate["itemId"];
  size: number;
  width: number;
}

/**
 * Cream crate, origin bottom-centre. The ring and mark tell the weapon: a sky ring with a rocket
 * bar (rocket launcher), a lilac ring with twin pods (homing launcher). The weapon-visuals lap may
 * replace this one function; callers only pass the item id.
 */
function drawCrate({ itemId, size, width }: CrateLook): Container {
  const half = size / 2;
  const homing = itemId === "homing-launcher";
  const crate = new Graphics()
    .roundRect(-half, -size, size, size, size * 0.24)
    .fill(GAME_PALETTE.pickupCrate)
    .stroke({ width, color: GAME_PALETTE.ink, join: "round" })
    .circle(0, -half, half * 0.62)
    .stroke({
      width: size * 0.1,
      color: homing ? GAME_PALETTE.pickupRingHoming : GAME_PALETTE.pickupRing,
    });
  if (!homing) {
    return crate
      .roundRect(-half * 0.45, -half - size * 0.09, half * 0.9, size * 0.18, size * 0.09)
      .fill(GAME_PALETTE.ink);
  }
  const pod = { w: half * 0.62, h: size * 0.13 };
  for (const dy of [-pod.h * 0.75, pod.h * 0.75]) {
    crate.roundRect(-pod.w / 2, -half + dy - pod.h / 2, pod.w, pod.h, pod.h / 2);
  }
  return crate
    .fill(GAME_PALETTE.pickupRingHoming)
    .stroke({ width: width * 0.6, color: GAME_PALETTE.ink });
}

/** Matches the crate and crate-shadow layers to the current crates. */
export function syncCrateLayers(layers: CrateLayers, frame: CrateFrame): void {
  const { crates, size, outline } = frame;
  syncDisplayById(layers.crateSprites, layers.crates, {
    list: crates,
    key: (crate) => `${crate.id}:${outline.step}`,
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
