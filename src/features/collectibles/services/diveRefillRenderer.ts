import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { syncDisplayById } from "@/shared/utils/displaySync";
import type { OutlineWidth } from "@/shared/utils/outlineWidth";
import type { DiveRefillPickup } from "@/features/collectibles/types/collectibles.types";

/**
 * Headbutt reset look (DESIGN_LANGUAGE § 1 Effects, GAME_JUICE § 6): an aqua diamond crystal
 * with the prop ink outline, a gloss facet and an ink up-chevron ("dive again"). While present it
 * bobs; when it comes back it pops in (back-out, `squash` window); when taken, a ring bursts out
 * and fades (`effect` window); until it is back, a faint ghost outline marks the point (Celeste's
 * refill outline). All derived from sim state, render only.
 */
const BOB = { amplitude: 2.5, periodMs: 1000 };
/** Pop-in on return, seconds (GAME_JUICE `squash` window 100–200 ms). */
const POP_IN_SECONDS = 0.15;
/** Collect burst, seconds (GAME_JUICE `effect` window 180–320 ms). */
const BURST_SECONDS = 0.22;
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
  burst: Graphics;
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
  const burst = new Graphics()
    .circle(0, 0, r)
    .stroke({ width: outline.width * 1.5, color: GAME_PALETTE.diveRefill });
  const root = new Container() as RefillSprite;
  root.addChild(ghost, burst, crystal);
  return Object.assign(root, { crystal, ghost, burst });
}

/** 0 → 1 with a back-out overshoot (the pop-in). */
const backOut = (t: number): number => {
  const c = 1.7;
  const u = t - 1;
  return 1 + (c + 1) * u * u * u + c * u * u;
};

function placeRefill(sprite: RefillSprite, refill: DiveRefillPickup, args: PlaceArgs): void {
  const present = refill.respawnTimer === 0;
  const sinceTaken = args.respawnSeconds - refill.respawnTimer;
  const bursting = !present && sinceTaken < BURST_SECONDS;
  sprite.crystal.visible = present;
  sprite.ghost.visible = !present && !bursting;
  sprite.burst.visible = bursting;
  const phase = ((args.nowMs + refill.pointIndex * 250) / BOB.periodMs) * Math.PI * 2;
  sprite.position.set(refill.x, refill.y + (present ? Math.sin(phase) * BOB.amplitude : 0));
  if (present) {
    const t = Math.min(1, refill.presentSeconds / POP_IN_SECONDS);
    sprite.crystal.scale.set(refill.presentSeconds < POP_IN_SECONDS ? backOut(t) : 1);
  }
  if (bursting) {
    const t = sinceTaken / BURST_SECONDS;
    sprite.burst.scale.set(1 + t);
    sprite.burst.alpha = 1 - t;
  }
}

interface PlaceArgs {
  respawnSeconds: number;
  nowMs: number;
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
