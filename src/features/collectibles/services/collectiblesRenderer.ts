import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { starPoints } from "@/shared/utils/shapeGeometry";
import { createContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { TerrainGrid } from "@/features/arena/api/arenaApi";
import {
  syncCrateLayers,
  type CrateLayers,
} from "@/features/collectibles/services/weaponCrateRenderer";
import type { CollectiblesState } from "@/features/collectibles/types/collectibles.types";

/**
 * Collectibles layers; the match renderer places them (DESIGN_LANGUAGE § 5): `shadows` (4,
 * contact shadows of falling weapon crates), `crates` (5, `weaponCrateRenderer.ts`), `orbs` (5,
 * point orbs). A point orb is a bubblegum star with an ink outline (§ 1 Effects), bobbing gently
 * once it hovers on its point. Drawn once per orb (and again when the zoom-clamped prop outline
 * width changes step); per frame only transforms change.
 */
export interface CollectiblesView extends CrateLayers {
  orbs: Container;
  orbSprites: Map<string, Container>;
}

const BOB = { amplitude: 3, periodMs: 1200 };

export function createCollectiblesView(): CollectiblesView {
  return {
    shadows: createContactShadowLayer("crate-shadows"),
    crates: new Container({ label: "weapon-crates" }),
    crateSprites: new Map(),
    orbs: new Container({ label: "collectibles" }),
    orbSprites: new Map(),
  };
}

function drawOrb(size: number, width: number): Container {
  const root = new Container();
  const outer = size * 0.6;
  root.addChild(
    new Graphics()
      .poly(starPoints(5, outer, outer * 0.55))
      .fill(GAME_PALETTE.pointOrb)
      .stroke({ width, color: GAME_PALETTE.ink, join: "round" }),
    new Graphics()
      .circle(-outer * 0.15, -outer * 0.2, outer * 0.14)
      .fill({ color: GAME_PALETTE.gloss, alpha: 0.75 })
  );
  return root;
}

export interface CollectiblesFrame {
  collectibles: CollectiblesState;
  /** Point-orb touch box, world units. */
  size: number;
  /** Weapon-crate box, world units. */
  crateSize: number;
  /** Terrain the crate shadows fall on. */
  terrain: TerrainGrid;
  /** Animation clock, ms. */
  nowMs: number;
  /** Camera zoom (screen px per world unit) for the outline width clamp. */
  zoom: number;
}

/** Matches the layers to the current crates and orbs. Call once per rendered frame. */
export function syncCollectiblesView(view: CollectiblesView, frame: CollectiblesFrame): void {
  const width = outlineWidth("prop", frame.zoom);
  syncCrateLayers(view, {
    crates: frame.collectibles.crates.list,
    size: frame.crateSize,
    outline: width,
    terrain: frame.terrain,
  });
  syncDisplayById(view.orbSprites, view.orbs, {
    list: frame.collectibles.orbs,
    key: (orb) => `${orb.id}:${width.step}`,
    create: () => drawOrb(frame.size, width.width),
    place: (sprite, orb) => {
      const hovering = orb.y >= orb.restY;
      const phase = ((frame.nowMs + orb.id * 300) / BOB.periodMs) * Math.PI * 2;
      sprite.position.set(orb.x, orb.y + (hovering ? Math.sin(phase) * BOB.amplitude : 0));
    },
  });
}
