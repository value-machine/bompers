import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { CollectiblesState } from "@/features/collectibles/types/collectibles.types";

/**
 * Point-orb layer: a bubblegum star with an ink outline (DESIGN_LANGUAGE § 1 Effects), bobbing
 * gently once it hovers on its point. Drawn once per orb; per frame only transforms change.
 */
export interface CollectiblesView {
  container: Container;
  sprites: Map<number, Container>;
}

const STROKE = 2.5;
const BOB = { amplitude: 3, periodMs: 1200 };

export function createCollectiblesView(): CollectiblesView {
  return { container: new Container({ label: "collectibles" }), sprites: new Map() };
}

function starPath(points: number, outer: number, inner: number): number[] {
  const path: number[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 - Math.PI / 2;
    path.push(Math.cos(a) * r, Math.sin(a) * r);
  }
  return path;
}

function drawOrb(size: number): Container {
  const root = new Container();
  const outer = size * 0.6;
  root.addChild(
    new Graphics()
      .poly(starPath(5, outer, outer * 0.55))
      .fill(GAME_PALETTE.pointOrb)
      .stroke({ width: STROKE, color: GAME_PALETTE.ink, join: "round" }),
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
}

/** Matches the layer to the current orbs. Call once per rendered frame. */
export function syncCollectiblesView(view: CollectiblesView, frame: CollectiblesFrame): void {
  const seen = new Set<number>();
  for (const orb of frame.collectibles.orbs) {
    seen.add(orb.id);
    let sprite = view.sprites.get(orb.id);
    if (!sprite) {
      sprite = drawOrb(frame.size);
      view.sprites.set(orb.id, sprite);
      view.container.addChild(sprite);
    }
    const hovering = orb.y >= orb.restY;
    const phase = ((frame.nowMs + orb.id * 300) / BOB.periodMs) * Math.PI * 2;
    sprite.position.set(orb.x, orb.y + (hovering ? Math.sin(phase) * BOB.amplitude : 0));
  }
  for (const [id, sprite] of view.sprites) {
    if (seen.has(id)) continue;
    sprite.destroy({ children: true });
    view.sprites.delete(id);
  }
}
