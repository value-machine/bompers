import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { starPoints } from "@/shared/utils/shapeGeometry";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth } from "@/shared/utils/outlineWidth";
import type { CollectiblesState } from "@/features/collectibles/types/collectibles.types";

/**
 * Point-orb layer: a bubblegum star with an ink outline (DESIGN_LANGUAGE § 1 Effects), bobbing
 * gently once it hovers on its point. Drawn once per orb (and again when the zoom-clamped prop
 * outline width changes step); per frame only transforms change.
 */
export interface CollectiblesView {
  container: Container;
  sprites: Map<string, Container>;
}

const BOB = { amplitude: 3, periodMs: 1200 };

export function createCollectiblesView(): CollectiblesView {
  return { container: new Container({ label: "collectibles" }), sprites: new Map() };
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
  size: number;
  /** Animation clock, ms. */
  nowMs: number;
  /** Camera zoom (screen px per world unit) for the outline width clamp. */
  zoom: number;
}

/** Matches the layer to the current orbs. Call once per rendered frame. */
export function syncCollectiblesView(view: CollectiblesView, frame: CollectiblesFrame): void {
  const width = outlineWidth("prop", frame.zoom);
  syncDisplayById(view.sprites, view.container, {
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
