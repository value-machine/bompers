import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncDisplayById } from "@/shared/utils/displaySync";
import type { OutlineWidth } from "@/shared/utils/outlineWidth";
import type { DiveRefillPickup } from "@/features/collectibles/types/collectibles.types";
import { popInScale } from "@/shared/utils/easing";

/**
 * Headbutt reset look (DESIGN_LANGUAGE § 1 Effects, GAME_JUICE § 6): an aqua diamond crystal
 * with the prop ink outline, a gloss facet and an ink up-chevron ("dive again"). While present it
 * bobs; when it comes back it pops in (`feel.pickup.popInSeconds`); when taken, the ring every
 * pickup shares bursts out (the collectibles renderer's burst layer); once the ring is gone, a
 * faint ghost outline marks the point until it is back (Celeste's refill outline). All derived
 * from sim state, render only.
 */
const BOB = { amplitude: 2.5, periodMs: 1000 };
const GHOST_ALPHA = 0.3;

export interface DiveRefillLayer {
  container: Container;
  sprites: Map<string, Container>;
}

export const createDiveRefillLayer = (): DiveRefillLayer => ({
  container: new Container({ label: "dive-refills" }),
  sprites: new Map(),
});

interface RefillSprite extends Container {
  crystal: Container;
  ghost: Graphics;
}

const diamond = (r: number): number[] => [0, -r, r * 0.72, 0, 0, r, -r * 0.72, 0];

function drawRefill(size: number, outline: OutlineWidth): RefillSprite {
  const r = size * 0.55;
  const ink = { width: outline.width, color: GAME_PALETTE.ink, join: "round" as const };
  const crystal = new Container();
  crystal.addChild(
    new Graphics().poly(diamond(r)).fill(GAME_PALETTE.diveRefill).stroke(ink),
    new Graphics()
      .poly([0, -r * 0.78, r * 0.38, -r * 0.1, 0, -r * 0.25])
      .fill({ color: GAME_PALETTE.gloss, alpha: 0.6 }),
    new Graphics()
      .poly([-r * 0.3, r * 0.3, 0, 0, r * 0.3, r * 0.3])
      .stroke({ ...ink, cap: "round" })
  );
  const ghost = new Graphics()
    .poly(diamond(r))
    .stroke({ ...ink, alpha: GHOST_ALPHA, color: GAME_PALETTE.ink });
  const root = new Container() as RefillSprite;
  root.addChild(ghost, crystal);
  return Object.assign(root, { crystal, ghost });
}

function placeRefill(sprite: RefillSprite, refill: DiveRefillPickup, args: PlaceArgs): void {
  const present = refill.respawnTimer === 0;
  const sinceTaken = args.respawnSeconds - refill.respawnTimer;
  sprite.crystal.visible = present;
  sprite.ghost.visible = !present && sinceTaken >= args.ringSeconds;
  const phase = ((args.nowMs + refill.pointIndex * 250) / BOB.periodMs) * Math.PI * 2;
  sprite.position.set(refill.x, refill.y + (present ? Math.sin(phase) * BOB.amplitude : 0));
  if (present) sprite.crystal.scale.set(popInScale(refill.presentSeconds / args.popInSeconds));
}

interface PlaceArgs {
  respawnSeconds: number;
  nowMs: number;
  /** `feel.pickup` pop-in and ring lengths. */
  popInSeconds: number;
  ringSeconds: number;
}

export interface DiveRefillFrame extends PlaceArgs {
  refills: readonly DiveRefillPickup[];
  /** Touch box, world units. */
  size: number;
  outline: OutlineWidth;
}

/** Matches the layer to the level's headbutt resets. Call once per rendered frame. */
export function syncDiveRefillLayer(layer: DiveRefillLayer, frame: DiveRefillFrame): void {
  syncDisplayById(layer.sprites, layer.container, {
    list: frame.refills,
    key: (refill) => `${refill.pointIndex}:${frame.outline.step}`,
    create: () => drawRefill(frame.size, frame.outline),
    place: (sprite, refill) => placeRefill(sprite as RefillSprite, refill, frame),
  });
}
