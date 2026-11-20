import { Graphics } from "pixi.js";
import { randomBetween, seededRandom } from "@/shared/utils/seededRandom";
import type {
  BackdropBand,
  BackdropCeiling,
} from "@/features/backdrop-themes/api/backdropThemesApi";

/**
 * One period of a backdrop band, drawn once and baked by the renderer (level-themes D1). The tile
 * is `2 × amplitude` tall plus a 1-px opaque bottom row; everything under it is the band's flat
 * base sprite. A transparent frame keeps the baked tile exactly one period wide. Shapes are seeded
 * from the band's size, so a theme always looks the same.
 */
export function bandTile(band: BackdropBand): Graphics {
  const height = band.amplitude * 2;
  const g = new Graphics()
    .rect(0, 0, band.period, height + 1)
    .fill({ color: band.color, alpha: 0 });
  const random = seededRandom(band.period * 31 + band.amplitude);
  if (band.shape === "hills") hills(g, band, height);
  else if (band.shape === "peaks") peaks(g, band, { height, random });
  else if (band.shape === "spires") spires(g, band, { height, random });
  else if (band.shape === "skyline" || band.shape === "roofs") blocks(g, band, { height, random });
  else rocks(g, band, { height, random });
  if (band.shape === "kelp") kelp(g, band, { height, random });
  return g;
}

interface ShapeArgs {
  height: number;
  random: () => number;
}

/** A big and a small rolling bump (the meadow's original hill). */
function hills(g: Graphics, band: BackdropBand, height: number): void {
  const { period, amplitude } = band;
  const half = period / 2;
  g.moveTo(0, height + 1).lineTo(0, height);
  g.quadraticCurveTo(half / 2, 0, half, height);
  g.quadraticCurveTo(half * 1.5, height - amplitude * 0.9, period, height);
  g.lineTo(period, height + 1)
    .closePath()
    .fill(band.color);
}

const PEAKS_PER_TILE = 3;

/** Three mountains with rounded tips; the middle one is the tallest; snow caps on top. */
function peaks(g: Graphics, band: BackdropBand, { height, random }: ShapeArgs): void {
  const step = band.period / PEAKS_PER_TILE;
  const foot = height * 0.55;
  const tips: Tip[] = [];
  g.moveTo(0, height + 1).lineTo(0, foot);
  for (let i = 0; i < PEAKS_PER_TILE; i += 1) {
    const tip = {
      x: (i + 0.5) * step,
      y: i === 1 ? 2 : height * randomBetween(random, 0.25, 0.45),
    };
    tips.push(tip);
    g.lineTo(tip.x - step * 0.12, tip.y + 10);
    g.quadraticCurveTo(tip.x, tip.y - 6, tip.x + step * 0.12, tip.y + 10);
    g.lineTo((i + 1) * step, foot);
  }
  g.lineTo(band.period, height + 1)
    .closePath()
    .fill(band.color);
  const { accentColor } = band;
  if (accentColor === undefined) return;
  for (const tip of tips) snowCap(g, { tip, step, height, color: accentColor });
}

interface Tip {
  x: number;
  y: number;
}

/** A snow cap over a peak's rounded tip, with a ragged lower edge. */
function snowCap(g: Graphics, cap: { tip: Tip; step: number; height: number; color: number }) {
  const { x, y } = cap.tip;
  const drop = (cap.height - y) * 0.28;
  g.moveTo(x - cap.step * 0.12 - 2, y + 10);
  g.quadraticCurveTo(x, y - 6, x + cap.step * 0.12 + 2, y + 10);
  g.lineTo(x + drop * 0.55, y + drop);
  g.lineTo(x + drop * 0.15, y + drop * 0.75);
  g.lineTo(x - drop * 0.2, y + drop * 1.05);
  g.lineTo(x - drop * 0.6, y + drop * 0.8);
  g.closePath().fill(cap.color);
}

const SPIRES_PER_TILE = 5;

/** Narrow pointed rock spires of uneven height over a low ridge. */
function spires(g: Graphics, band: BackdropBand, { height, random }: ShapeArgs): void {
  const step = band.period / SPIRES_PER_TILE;
  const ridge = height * 0.7;
  g.moveTo(0, height + 1).lineTo(0, ridge);
  for (let i = 0; i < SPIRES_PER_TILE; i += 1) {
    const left = i * step;
    const mid = left + step / 2;
    const top = height * randomBetween(random, 0.05, 0.55);
    g.lineTo(left + step * 0.18, ridge);
    g.quadraticCurveTo(mid - 8, top + 40, mid, top);
    g.quadraticCurveTo(mid + 8, top + 40, left + step * 0.82, ridge);
  }
  g.lineTo(band.period, ridge)
    .lineTo(band.period, height + 1)
    .closePath()
    .fill(band.color);
}

const ROCKS_PER_TILE = 7;

/** A jagged rocky edge; starts and ends at the same height so tiles join. */
function rocks(g: Graphics, band: BackdropBand, { height, random }: ShapeArgs): void {
  const step = band.period / ROCKS_PER_TILE;
  const edge = height * 0.55;
  g.moveTo(0, height + 1).lineTo(0, edge);
  for (let i = 1; i <= ROCKS_PER_TILE; i += 1) {
    const y = i === ROCKS_PER_TILE ? edge : height * randomBetween(random, 0.1, 0.75);
    g.quadraticCurveTo(i * step - step / 2, y - 14, i * step, y);
  }
  g.lineTo(band.period, height + 1)
    .closePath()
    .fill(band.color);
}

const KELP_PER_TILE = 5;
const KELP_SEGMENTS = 6;

/** Tall wavy kelp stalks standing on the rocks, reaching up to the top of the tile. */
function kelp(g: Graphics, band: BackdropBand, { height, random }: ShapeArgs): void {
  const step = band.period / KELP_PER_TILE;
  for (let k = 0; k < KELP_PER_TILE; k += 1) {
    const x = step * (k + randomBetween(random, 0.3, 0.7));
    const top = height * randomBetween(random, 0, 0.35);
    g.moveTo(x, height);
    for (let i = 1; i <= KELP_SEGMENTS; i += 1) {
      g.lineTo(x + Math.sin(i * 1.3 + k) * 7, height + ((top - height) * i) / KELP_SEGMENTS);
    }
    g.stroke({ color: band.color, width: 8, cap: "round", join: "round" });
  }
}

/**
 * Buildings of uneven height side by side. `skyline`: flat tops with lit windows (accent colour);
 * `roofs`: lower blocks with pitched roofs and the odd chimney.
 */
function blocks(g: Graphics, band: BackdropBand, { height, random }: ShapeArgs): void {
  const skyline = band.shape === "skyline";
  for (let x = 0; x < band.period; ) {
    const width = Math.min(band.period - x, randomBetween(random, 50, 120));
    const top =
      height * (skyline ? randomBetween(random, 0.05, 0.6) : randomBetween(random, 0.4, 0.75));
    g.rect(x, top, width + 0.5, height + 1 - top).fill(band.color);
    if (!skyline) roof(g, { x, top, width, color: band.color, chimney: random() > 0.4 });
    else if (band.accentColor !== undefined) {
      windows(g, { x, top, width, bottom: height, color: band.accentColor, random });
    }
    x += width;
  }
}

function roof(
  g: Graphics,
  r: { x: number; top: number; width: number; color: number; chimney: boolean }
) {
  g.moveTo(r.x - 2, r.top)
    .lineTo(r.x + r.width / 2, r.top - 24)
    .lineTo(r.x + r.width + 2, r.top)
    .closePath()
    .fill(r.color);
  if (r.chimney) g.rect(r.x + r.width * 0.68, r.top - 32, 12, 26).fill(r.color);
}

interface WindowArgs {
  x: number;
  top: number;
  width: number;
  bottom: number;
  color: number;
  random: () => number;
}

/** About a third of the window grid is lit. */
function windows(g: Graphics, w: WindowArgs): void {
  for (let y = w.top + 14; y < w.bottom - 10; y += 20) {
    for (let x = w.x + 8; x < w.x + w.width - 12; x += 16) {
      if (w.random() > 0.62) g.rect(x, y, 7, 9).fill(w.color);
    }
  }
}

const DRIPS_PER_TILE = 6;
/** Solid strip along the top of a ceiling tile (px). */
export const CEILING_STRIP = 8;

/** One period of a hanging ceiling: a solid strip with pointed drips of uneven length. */
export function ceilingTile(ceiling: BackdropCeiling): Graphics {
  const { period, depth, color } = ceiling;
  const random = seededRandom(period * 17 + depth);
  const step = period / DRIPS_PER_TILE;
  const g = new Graphics().rect(0, 0, period, depth).fill({ color, alpha: 0 });
  g.moveTo(0, 0).lineTo(0, CEILING_STRIP);
  for (let i = 0; i < DRIPS_PER_TILE; i += 1) {
    const left = i * step;
    const mid = left + step / 2;
    const tip = depth * randomBetween(random, 0.35, 1);
    g.lineTo(left + step * 0.15, CEILING_STRIP);
    g.quadraticCurveTo(mid - 5, tip * 0.6, mid, tip);
    g.quadraticCurveTo(mid + 5, tip * 0.6, left + step * 0.85, CEILING_STRIP);
  }
  return g.lineTo(period, CEILING_STRIP).lineTo(period, 0).closePath().fill(color);
}
