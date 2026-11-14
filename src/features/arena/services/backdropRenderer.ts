import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";

/**
 * Screen-space backdrop behind the world (DESIGN_LANGUAGE § 1 World, § 5 steps 1–2): vertical sky
 * gradient, flat sun, far hills + clouds at parallax 0.2, near hills at parallax 0.4. Everything
 * is drawn once; per frame only positions change. Hill and cloud bands are drawn wider than any
 * screen and slid by their period, so they repeat without seams.
 */
export interface BackdropView {
  root: Container;
  sky: Sprite;
  sun: Graphics;
  far: Graphics;
  clouds: Graphics;
  near: Graphics;
}

export interface BackdropFrame {
  viewport: { width: number; height: number };
  /** Camera centre (world units) and zoom; parallax follows it. */
  camera: { centerX: number; centerY: number; zoom: number };
  worldHeight: number;
  nowMs: number;
}

const toCss = (color: number): string => `#${color.toString(16).padStart(6, "0")}`;
/** Widest screen the bands cover without a gap (px). */
const BAND_WIDTH = 4096;
const FAR = { period: 960, amplitude: 70, parallax: 0.2, base: 0.56 };
const NEAR = { period: 720, amplitude: 46, parallax: 0.4, base: 0.7 };
const CLOUDS = { period: 1400, parallax: 0.2, driftPxPerSecond: 6, edge: 3 };
/** Puffs of one cloud: [dx, dy, r] (px). */
const CLOUD_PUFFS: readonly (readonly [number, number, number])[] = [
  [0, 0, 26],
  [30, -12, 32],
  [64, 0, 24],
  [32, 8, 22],
];
const CLOUD_SPOTS: readonly (readonly [number, number, number])[] = [
  [120, 110, 1],
  [560, 70, 0.8],
  [980, 150, 1.15],
];

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

/** Rolling hill band: smooth bumps every half period, filled far below the screen. */
function hillBand(look: { period: number; amplitude: number }, color: number): Graphics {
  const g = new Graphics();
  const half = look.period / 2;
  g.moveTo(0, 2000).lineTo(0, 0);
  for (let x = 0, i = 0; x < BAND_WIDTH + look.period; x += half, i += 1) {
    const peak = i % 2 === 0 ? -look.amplitude : -look.amplitude * 0.45;
    g.quadraticCurveTo(x + half / 2, peak * 2, x + half, 0);
  }
  return g
    .lineTo(BAND_WIDTH + look.period * 1.5, 2000)
    .closePath()
    .fill(color);
}

/** Clouds with a soft edge colour instead of ink, so they read as background. */
function cloudBand(): Graphics {
  const g = new Graphics();
  const { cloud, cloudEdge } = GAME_PALETTE.backdrop;
  for (let base = 0; base < BAND_WIDTH + CLOUDS.period; base += CLOUDS.period) {
    for (const [x, y, s] of CLOUD_SPOTS) {
      for (const [dx, dy, r] of CLOUD_PUFFS)
        g.circle(base + x + dx * s, y + dy * s, r * s + CLOUDS.edge);
      g.fill(cloudEdge);
      for (const [dx, dy, r] of CLOUD_PUFFS) g.circle(base + x + dx * s, y + dy * s, r * s);
      g.fill(cloud);
    }
  }
  return g;
}

export function createBackdropView(): BackdropView {
  const root = new Container({ label: "backdrop" });
  const sky = new Sprite(skyTexture());
  const sun = new Graphics().circle(0, 0, 56).fill(GAME_PALETTE.backdrop.sun);
  const far = hillBand(FAR, GAME_PALETTE.backdrop.hillsFar);
  const clouds = cloudBand();
  const near = hillBand(NEAR, GAME_PALETTE.backdrop.hillsNear);
  root.addChild(sky, sun, far, clouds, near);
  return { root, sky, sun, far, clouds, near };
}

const wrap = (value: number, period: number): number => ((value % period) + period) % period;

/** Positions the backdrop for this frame's viewport and camera. */
export function syncBackdropView(view: BackdropView, frame: BackdropFrame): void {
  const { viewport, camera, worldHeight, nowMs } = frame;
  const scale = Math.min(1, viewport.width / 1280);
  view.sky.width = viewport.width;
  view.sky.height = viewport.height;
  view.sun.position.set(viewport.width * 0.82, viewport.height * 0.16);
  view.sun.scale.set(scale);
  // Vertical parallax: hills sink as the camera looks higher than the arena middle.
  const lift = (camera.centerY - worldHeight / 2) * camera.zoom;
  const place = (band: Graphics, look: { period: number; parallax: number; base: number }) => {
    band.position.set(
      -wrap(camera.centerX * camera.zoom * look.parallax, look.period),
      viewport.height * look.base - lift * look.parallax
    );
  };
  place(view.far, FAR);
  place(view.near, NEAR);
  const drift = (nowMs / 1000) * CLOUDS.driftPxPerSecond;
  view.clouds.position.set(
    -wrap(camera.centerX * camera.zoom * CLOUDS.parallax + drift, CLOUDS.period),
    -lift * CLOUDS.parallax * 0.5
  );
}
