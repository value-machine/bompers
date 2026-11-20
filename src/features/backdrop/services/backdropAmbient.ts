import { Container, Graphics, Sprite, type Renderer } from "pixi.js";
import { seededRandom } from "@/shared/utils/seededRandom";
import type {
  BackdropAmbient,
  BackdropAmbientKind,
} from "@/features/backdrop-themes/api/backdropThemesApi";

/**
 * Ambient particles of a theme (stars, snow, embers, bubbles), in screen space behind the world. One baked
 * dot texture shared by every particle; a frame only moves, fades and scales sprites, and each
 * particle's place is a pure function of time and camera, so no state is kept between frames.
 */
export interface AmbientSeed {
  /** 0–1 across and down the screen. */
  x: number;
  y: number;
  /** 0.5–1.5: size and speed spread. */
  size: number;
  phase: number;
}

export interface AmbientPose {
  x: number;
  y: number;
  alpha: number;
  scale: number;
}

export interface AmbientView {
  layer: Container;
  sprites: Sprite[];
  seeds: AmbientSeed[];
  kind: BackdropAmbientKind;
}

export interface AmbientScreen {
  width: number;
  height: number;
  /** Camera x in screen px (centre × zoom); particles drift with it at their own parallax. */
  cameraX: number;
  nowMs: number;
}

const DOT_RADIUS = 4;
/** Stars stay in the upper part of the sky. */
const STAR_BAND = 0.6;
const LOOK = {
  stars: { parallax: 0.05, speed: 0, radius: 0.35 },
  snow: { parallax: 0.3, speed: 22, radius: 0.55 },
  embers: { parallax: 0.25, speed: 0.1, radius: 0.45 },
  bubbles: { parallax: 0.3, speed: 0.06, radius: 0.6 },
} as const;

const wrap = (value: number, period: number): number => ((value % period) + period) % period;

export function ambientSeeds(count: number, seed: number): AmbientSeed[] {
  const random = seededRandom(seed);
  return Array.from({ length: count }, () => ({
    x: random(),
    y: random(),
    size: 0.5 + random(),
    phase: random() * Math.PI * 2,
  }));
}

/** Where one particle is at this moment (screen px). */
export function ambientPose(
  kind: BackdropAmbientKind,
  seed: AmbientSeed,
  screen: AmbientScreen
): AmbientPose {
  const { width, height, cameraX } = screen;
  const s = screen.nowMs / 1000;
  const look = LOOK[kind];
  const scale = look.radius * seed.size;
  if (kind === "stars") {
    const twinkle = Math.abs(Math.sin(s * 1.4 * seed.size + seed.phase));
    return {
      x: wrap(seed.x * width - cameraX * look.parallax, width),
      y: seed.y * height * STAR_BAND,
      alpha: 0.45 + 0.55 * twinkle,
      scale,
    };
  }
  if (kind === "snow") {
    const sway = Math.sin(s * 0.8 + seed.phase) * 10;
    return {
      x: wrap(seed.x * width + sway - cameraX * look.parallax * seed.size, width),
      y: wrap(seed.y * height + s * look.speed * seed.size, height),
      alpha: 0.9,
      scale,
    };
  }
  return risingPose(kind === "embers", seed, { ...screen, scale });
}

/**
 * Embers and bubbles rise from the bottom and wrap. Embers flicker and fade on the way up;
 * bubbles wobble and stay half see-through.
 */
function risingPose(
  ember: boolean,
  seed: AmbientSeed,
  screen: AmbientScreen & { scale: number }
): AmbientPose {
  const s = screen.nowMs / 1000;
  const look = ember ? LOOK.embers : LOOK.bubbles;
  const life = wrap(seed.y + s * look.speed * seed.size, 1);
  const sway = Math.sin(s * (ember ? 1.5 : 2) + seed.phase) * (ember ? 8 : 4);
  const flicker = 0.6 + 0.4 * Math.sin(s * 9 + seed.phase);
  return {
    x: wrap(seed.x * screen.width + sway - screen.cameraX * look.parallax, screen.width),
    y: screen.height * (1 - life),
    alpha: ember ? Math.min(1, (1 - life) * 1.6) * flicker : 0.65,
    scale: screen.scale,
  };
}

export function createAmbientView(renderer: Renderer, ambient: BackdropAmbient): AmbientView {
  const dot = new Graphics().circle(0, 0, DOT_RADIUS).fill(0xffffff);
  const texture = renderer.generateTexture({ target: dot, antialias: true });
  dot.destroy();
  const layer = new Container({ label: "ambient" });
  const seeds = ambientSeeds(ambient.count, ambient.count * 97 + ambient.kind.length);
  const sprites = seeds.map((_, i) => {
    const sprite = new Sprite({
      texture,
      tint: ambient.colors[i % ambient.colors.length] ?? 0xffffff,
    });
    sprite.anchor.set(0.5);
    layer.addChild(sprite);
    return sprite;
  });
  return { layer, sprites, seeds, kind: ambient.kind };
}

export function syncAmbientView(view: AmbientView, screen: AmbientScreen): void {
  view.sprites.forEach((sprite, i) => {
    const seed = view.seeds[i];
    if (!seed) return;
    const pose = ambientPose(view.kind, seed, screen);
    sprite.position.set(pose.x, pose.y);
    sprite.alpha = pose.alpha;
    sprite.scale.set(pose.scale);
  });
}
