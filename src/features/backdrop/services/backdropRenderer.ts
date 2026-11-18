import { Container, Graphics, Sprite, Texture, TilingSprite, type Renderer } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";

/**
 * Screen-space backdrop behind the world (DESIGN_LANGUAGE § 1 World, § 5 steps 1–2): vertical sky
 * gradient, flat sun, far hills + clouds at parallax 0.2, near hills at parallax 0.4.
 *
 * Everything is baked once into textures and shown as sprites, so a frame only moves quads:
 * the sky is a 2 × 256 gradient stretched to the screen; each hill band is one period baked and
 * repeated by a `TilingSprite` (only the bumpy top strip has transparent pixels), with an opaque
 * flat-colour sprite below it down to the screen bottom; clouds are one baked cloud texture
 * reused by a few sprites. No layer is a full-screen alpha layer.
 */
export interface BackdropView {
  root: Container;
  sky: Sprite;
  sun: Sprite;
  far: HillBand;
  clouds: Container;
  near: HillBand;
}

interface HillBand {
  top: TilingSprite;
  base: Sprite;
  look: HillLook;
}

interface HillLook {
  period: number;
  amplitude: number;
  parallax: number;
  /** Baseline as a fraction of the screen height. */
  base: number;
}

export interface BackdropFrame {
  viewport: { width: number; height: number };
  /** Camera centre (world units) and zoom; parallax follows it. */
  camera: { centerX: number; centerY: number; zoom: number };
  worldHeight: number;
  nowMs: number;
}

const toCss = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
const FAR: HillLook = { period: 960, amplitude: 70, parallax: 0.2, base: 0.56 };
const NEAR: HillLook = { period: 720, amplitude: 46, parallax: 0.4, base: 0.7 };
const CLOUDS = { period: 1400, parallax: 0.2, driftPxPerSecond: 6, edge: 3, copies: 4 };
/** Puffs of one cloud: [dx, dy, r] (px). */
const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [0, 0, 26],
  [30, -12, 32],
  [64, 0, 24],
  [32, 8, 22],
];
/** Clouds in one period: [x, y, scale]. */
const CLOUD_SPOTS: readonly (readonly [number, number, number])[] = [
  [120, 110, 1],
  [560, 70, 0.8],
  [980, 150, 1.15],
];
const SUN_RADIUS = 56;

function skyTexture(): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, toCss(GAME_PALETTE.sky.top));
    gradient.addColorStop(1, toCss(GAME_PALETTE.sky.bottom));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  return Texture.from(canvas);
}

/** Bakes a Graphics into a texture and frees the Graphics. */
function bake(renderer: Renderer, graphics: Graphics): Texture {
  const texture = renderer.generateTexture({ target: graphics, antialias: true });
  graphics.destroy();
  return texture;
}

/** One period of rolling hills (a big and a small bump), from the peaks down to the baseline. */
function hillTile(look: HillLook, color: number): Graphics {
  const half = look.period / 2;
  const height = look.amplitude * 2;
  // A transparent 1-px frame keeps the baked tile exactly one period wide.
  const g = new Graphics().rect(0, 0, look.period, height + 1).fill({ color, alpha: 0 });
  g.moveTo(0, height + 1).lineTo(0, height);
  g.quadraticCurveTo(half / 2, 0, half, height);
  g.quadraticCurveTo(half * 1.5, height - look.amplitude * 0.9, look.period, height);
  return g
    .lineTo(look.period, height + 1)
    .closePath()
    .fill(color);
}

function hillBand(renderer: Renderer, look: HillLook, color: number): HillBand {
  const texture = bake(renderer, hillTile(look, color));
  const top = new TilingSprite({ texture, width: 1, height: texture.height });
  const base = new Sprite({ texture: Texture.WHITE, tint: color });
  return { top, base, look };
}

/** One cloud with a soft edge colour instead of ink, so it reads as background. */
function cloudGraphic(): Graphics {
  const g = new Graphics();
  const { cloud, cloudEdge } = GAME_PALETTE.backdrop;
  for (const [dx, dy, r] of CLOUD_PUFFS) g.circle(dx, dy, r + CLOUDS.edge);
  g.fill(cloudEdge);
  for (const [dx, dy, r] of CLOUD_PUFFS) g.circle(dx, dy, r);
  return g.fill(cloud);
}

function cloudLayer(renderer: Renderer): Container {
  const texture = bake(renderer, cloudGraphic());
  const layer = new Container({ label: "clouds" });
  for (let copy = 0; copy < CLOUDS.copies; copy += 1) {
    for (const [x, y, scale] of CLOUD_SPOTS) {
      const sprite = new Sprite(texture);
      sprite.scale.set(scale);
      sprite.position.set(copy * CLOUDS.period + x, y);
      layer.addChild(sprite);
    }
  }
  return layer;
}

export function createBackdropView(renderer: Renderer): BackdropView {
  const root = new Container({ label: "backdrop" });
  const sky = new Sprite(skyTexture());
  const sun = new Sprite(
    bake(renderer, new Graphics().circle(0, 0, SUN_RADIUS).fill(GAME_PALETTE.backdrop.sun))
  );
  sun.anchor.set(0.5);
  const far = hillBand(renderer, FAR, GAME_PALETTE.backdrop.hillsFar);
  const clouds = cloudLayer(renderer);
  const near = hillBand(renderer, NEAR, GAME_PALETTE.backdrop.hillsNear);
  root.addChild(sky, sun, far.top, far.base, clouds, near.top, near.base);
  return { root, sky, sun, far, clouds, near };
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;

/**
 * Slides a band by its parallax and fills below it with its flat colour, down to `bottom` (where
 * the next opaque layer starts), so no pixel is painted twice.
 */
function placeBand(band: HillBand, frame: BackdropFrame, args: { lift: number; bottom: number }) {
  const { viewport, camera } = frame;
  const { look, top, base } = band;
  const y = viewport.height * look.base - args.lift * look.parallax - top.height;
  top.width = viewport.width;
  top.position.set(0, y);
  top.tilePosition.x = -wrap(camera.centerX * camera.zoom * look.parallax, look.period);
  const baseTop = y + top.height - 1;
  base.position.set(0, baseTop);
  base.width = viewport.width;
  base.height = Math.max(0, args.bottom - baseTop);
  return { top: y, bottom: y + top.height };
}

/** Positions the backdrop for this frame's viewport and camera. */
export function syncBackdropView(view: BackdropView, frame: BackdropFrame): void {
  const { viewport, camera, worldHeight, nowMs } = frame;
  // Vertical parallax: hills sink as the camera looks higher than the arena middle.
  const lift = (camera.centerY - worldHeight / 2) * camera.zoom;
  // Front to back, each layer stops where the opaque part of the one in front begins.
  const near = placeBand(view.near, frame, { lift, bottom: viewport.height });
  const far = placeBand(view.far, frame, { lift, bottom: Math.max(near.bottom, 0) });
  view.sky.width = viewport.width;
  view.sky.height = Math.min(viewport.height, Math.max(0, far.bottom));
  view.sun.position.set(viewport.width * 0.82, viewport.height * 0.16);
  view.sun.scale.set(Math.min(1, viewport.width / 1280));
  const drift = (nowMs / 1000) * CLOUDS.driftPxPerSecond;
  view.clouds.position.set(
    -wrap(camera.centerX * camera.zoom * CLOUDS.parallax + drift, CLOUDS.period),
    -lift * CLOUDS.parallax * 0.5
  );
}
