import { Container, Graphics, Sprite, Texture, TilingSprite, type Renderer } from "pixi.js";
import { toCssColor } from "@/shared/config/gamePalette";
import {
  createAmbientView,
  syncAmbientView,
  type AmbientView,
} from "@/features/backdrop/services/backdropAmbient";
import { bandTile, ceilingTile } from "@/features/backdrop/services/backdropBands";
import type {
  BackdropBand,
  BackdropCeiling,
  BackdropDisc,
  BackdropTheme,
} from "@/features/backdrop-themes/api/backdropThemesApi";

/**
 * Screen-space backdrop behind the world (DESIGN_LANGUAGE § 1 World, § 5 steps 1–2), drawn from
 * the level's theme (level-themes D1): vertical sky gradient, sun or moon, an optional hanging
 * ceiling, far band + clouds at parallax 0.2, near band at 0.4, ambient particles.
 *
 * Everything is baked once into textures and shown as sprites, so a frame only moves quads:
 * the sky is a 2 × 256 gradient stretched to the screen; each band is one period baked and
 * repeated by a `TilingSprite` (only the bumpy top strip has transparent pixels), with an opaque
 * flat-colour sprite below it down to the screen bottom; clouds are one baked cloud texture
 * reused by a few sprites; particles share one baked dot. No layer is a full-screen alpha layer.
 */
export interface BackdropView {
  root: Container;
  theme: BackdropTheme;
  sky: Sprite;
  disc: { sprite: Sprite; look: BackdropDisc } | null;
  ceiling: { sprite: TilingSprite; look: BackdropCeiling } | null;
  far: BandView;
  clouds: Container | null;
  near: BandView;
  ambient: AmbientView | null;
}

interface BandView {
  top: TilingSprite;
  base: Sprite;
  look: BackdropBand;
}

export interface BackdropFrame {
  viewport: { width: number; height: number };
  /** Camera centre (world units) and zoom; parallax follows it. */
  camera: { centerX: number; centerY: number; zoom: number };
  worldHeight: number;
  nowMs: number;
}

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
/** Moon craters: [dx, dy, r] as fractions of the moon's radius. */
const MOON_CRATERS: readonly (readonly [number, number, number])[] = [
  [-0.3, -0.2, 0.22],
  [0.25, 0.18, 0.17],
  [-0.08, 0.4, 0.12],
];
/** Screen width at which the sun or moon is drawn at full size. */
const DISC_FULL_WIDTH = 1280;

function skyTexture(sky: BackdropTheme["sky"]): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, toCssColor(sky.top));
    gradient.addColorStop(1, toCssColor(sky.bottom));
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

function bandView(renderer: Renderer, look: BackdropBand): BandView {
  const texture = bake(renderer, bandTile(look));
  const top = new TilingSprite({ texture, width: 1, height: texture.height });
  const base = new Sprite({ texture: Texture.WHITE, tint: look.color });
  return { top, base, look };
}

/** One cloud with a soft edge colour instead of ink, so it reads as background. */
function cloudGraphic(look: NonNullable<BackdropTheme["clouds"]>): Graphics {
  const g = new Graphics();
  for (const [dx, dy, r] of CLOUD_PUFFS) g.circle(dx, dy, r + CLOUDS.edge);
  g.fill(look.edge);
  for (const [dx, dy, r] of CLOUD_PUFFS) g.circle(dx, dy, r);
  return g.fill(look.color);
}

function cloudLayer(renderer: Renderer, look: NonNullable<BackdropTheme["clouds"]>): Container {
  const texture = bake(renderer, cloudGraphic(look));
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

/** A flat disc, no outline; the moon gets a few flat craters. */
function discGraphic(look: BackdropDisc): Graphics {
  const g = new Graphics().circle(0, 0, look.radius).fill(look.color);
  if (look.kind !== "moon" || look.craterColor === undefined) return g;
  for (const [dx, dy, r] of MOON_CRATERS)
    g.circle(dx * look.radius, dy * look.radius, r * look.radius);
  return g.fill(look.craterColor);
}

function discView(renderer: Renderer, look: BackdropDisc | null): BackdropView["disc"] {
  if (!look) return null;
  const sprite = new Sprite(bake(renderer, discGraphic(look)));
  sprite.anchor.set(0.5);
  return { sprite, look };
}

function ceilingView(renderer: Renderer, look: BackdropCeiling | null): BackdropView["ceiling"] {
  if (!look) return null;
  const texture = bake(renderer, ceilingTile(look));
  return { sprite: new TilingSprite({ texture, width: 1, height: texture.height }), look };
}

export function createBackdropView(renderer: Renderer, theme: BackdropTheme): BackdropView {
  const root = new Container({ label: `backdrop:${theme.id}` });
  const sky = new Sprite(skyTexture(theme.sky));
  const disc = discView(renderer, theme.disc);
  const ceiling = ceilingView(renderer, theme.ceiling);
  const far = bandView(renderer, theme.far);
  const clouds = theme.clouds ? cloudLayer(renderer, theme.clouds) : null;
  const near = bandView(renderer, theme.near);
  const ambient = theme.ambient ? createAmbientView(renderer, theme.ambient) : null;
  // Stars hang behind the hills; snow and embers float in front of them (still behind the world).
  const stars = ambient?.kind === "stars" ? ambient.layer : null;
  const floating = ambient && ambient.kind !== "stars" ? ambient.layer : null;
  const layers = [
    sky,
    disc?.sprite,
    stars,
    ceiling?.sprite,
    far.top,
    far.base,
    clouds,
    near.top,
    near.base,
    floating,
  ].filter((layer): layer is Container => layer !== null && layer !== undefined);
  root.addChild(...layers);
  return { root, theme, sky, disc, ceiling, far, clouds, near, ambient };
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;

/**
 * Slides a band by its parallax and fills below it with its flat colour, down to `bottom` (where
 * the next opaque layer starts), so no pixel is painted twice.
 */
function placeBand(band: BandView, frame: BackdropFrame, args: { lift: number; bottom: number }) {
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

/** Slides the ceiling; it rises out of view as the camera looks down, never leaving a gap above. */
function placeCeiling(
  ceiling: NonNullable<BackdropView["ceiling"]>,
  args: { width: number; scrollX: number; lift: number }
): void {
  const { sprite, look } = ceiling;
  sprite.width = args.width;
  sprite.position.set(0, Math.min(0, -args.lift * look.parallax));
  sprite.tilePosition.x = -wrap(args.scrollX * look.parallax, look.period);
}

function placeSkyDetails(view: BackdropView, frame: BackdropFrame, lift: number): void {
  const { viewport, camera, nowMs } = frame;
  const scrollX = camera.centerX * camera.zoom;
  if (view.disc) {
    const { sprite, look } = view.disc;
    sprite.position.set(viewport.width * look.at.x, viewport.height * look.at.y);
    sprite.scale.set(Math.min(1, viewport.width / DISC_FULL_WIDTH));
  }
  if (view.ceiling) placeCeiling(view.ceiling, { width: viewport.width, scrollX, lift });
  if (view.clouds) {
    const drift = (nowMs / 1000) * CLOUDS.driftPxPerSecond;
    view.clouds.position.set(
      -wrap(scrollX * CLOUDS.parallax + drift, CLOUDS.period),
      -lift * CLOUDS.parallax * 0.5
    );
  }
  if (view.ambient) {
    syncAmbientView(view.ambient, { ...viewport, cameraX: scrollX, nowMs });
  }
}

/** Positions the backdrop for this frame's viewport and camera. */
export function syncBackdropView(view: BackdropView, frame: BackdropFrame): void {
  const { viewport, camera, worldHeight } = frame;
  // Vertical parallax: hills sink as the camera looks higher than the arena middle.
  const lift = (camera.centerY - worldHeight / 2) * camera.zoom;
  // Front to back, each layer stops where the opaque part of the one in front begins.
  const near = placeBand(view.near, frame, { lift, bottom: viewport.height });
  const far = placeBand(view.far, frame, { lift, bottom: Math.max(near.bottom, 0) });
  view.sky.width = viewport.width;
  view.sky.height = Math.min(viewport.height, Math.max(0, far.bottom));
  placeSkyDetails(view, frame, lift);
}
