import { FillGradient, Graphics } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import { traceEmblem } from "@/shared/services/emblemRenderer";
import { playerEmblemShape } from "@/shared/utils/playerEmblem";

/**
 * Blob shapes in line style E (DESIGN_LANGUAGE § 2–3, mockup variant E). Geometry is the mockup's
 * at its reference size (R = 30) times `u = r / 30`, so the proportions match the owner's pick.
 * Every outlined part has one path function, used twice: stroked in ink at twice the outline width
 * (ink pass, under everything) and filled on top (fill pass). Only the outer half of the ink
 * survives, which is the silhouette line. Inner details (gloss, eyes, emblem) have no outline.
 * Origin of torso shapes: the body centre. Origin of a foot: its ground point.
 */
export interface BlobMetrics {
  /** Body half-width R (world units). */
  r: number;
  /** Mockup unit: r / 30. */
  u: number;
  /** Body centre height above the feet point. */
  bodyLift: number;
  /** Helmet: half-width, dome top and rim (y, torso space). */
  helmet: { half: number; top: number; rim: number };
}

/** Body bottom sits 9 mockup units above the ground; body spans 1.94 R tall (§ 2). */
export function blobMetrics(height: number): BlobMetrics {
  // Body top (9u + 2r above the feet) meets the collision height; u = r / 30.
  const r = height / 2.3;
  const u = r / 30;
  return {
    r,
    u,
    bodyLift: 9 * u + r,
    helmet: { half: r + 2 * u, top: -r - 3 * u, rim: -0.18 * r },
  };
}

/** Soft egg from four cubic curves: widest a little below the middle, fuller at the bottom. */
export function eggPath(g: Graphics, r: number): Graphics {
  const t = r;
  const b = r * 0.94;
  const k = 0.56 * 1.05;
  return g
    .moveTo(0, -t)
    .bezierCurveTo(r * k, -t, r, -t * 0.52, r, b * 0.08)
    .bezierCurveTo(r, b * 0.66, r * 0.6, b, 0, b)
    .bezierCurveTo(-r * 0.6, b, -r, b * 0.66, -r, b * 0.08)
    .bezierCurveTo(-r, -t * 0.52, -r * k, -t, 0, -t)
    .closePath();
}

/** Helmet dome over the top of the body, with a slightly curved rim. */
export function helmetPath(g: Graphics, m: BlobMetrics): Graphics {
  const { half, top, rim } = m.helmet;
  const lift = 8 * m.u;
  return g
    .moveTo(-half, rim)
    .bezierCurveTo(-half, top - lift, half, top - lift, half, rim)
    .quadraticCurveTo(0, rim + 7 * m.u, -half, rim)
    .closePath();
}

/** Height of a foot's centre above its ground point, mockup units (the foot turns around it). */
export const FOOT_CENTRE_UNITS = 6;

/** One foot (0.4 R × 0.25 R), centred `FOOT_CENTRE_UNITS` above its ground point. */
export const footPath = (g: Graphics, m: BlobMetrics): Graphics =>
  g.ellipse(0, -FOOT_CENTRE_UNITS * m.u, 12 * m.u, 7.5 * m.u);

/** Rocket tube (26 × 14) with its cap (8 × 16), along +x from the pivot. */
export const tubePath = (g: Graphics, u: number): Graphics =>
  g
    .roundRect(-3 * u, -7 * u, 26 * u, 14 * u, 6 * u)
    .roundRect(17 * u, -8 * u, 8 * u, 16 * u, 3.5 * u);

const slotColor = (colors: readonly number[], slot: number): number =>
  colors[slot % colors.length] ?? GAME_PALETTE.ink;

const bodyGradients = new Map<number, FillGradient>();
let helmetGradient: FillGradient | null = null;

/** Radial body gradient (tint → body → shade), one cached per slot (§ 3 Body shading). */
function bodyGradient(slot: number): FillGradient {
  const key = slot % GAME_PALETTE.players.length;
  const cached = bodyGradients.get(key);
  if (cached) return cached;
  const gradient = new FillGradient({
    type: "radial",
    center: { x: 0.36, y: 0.3 },
    innerRadius: 0,
    outerCenter: { x: 0.36, y: 0.3 },
    outerRadius: 0.8,
    colorStops: [
      { offset: 0, color: slotColor(GAME_PALETTE.playerTints, key) },
      { offset: 0.55, color: slotColor(GAME_PALETTE.players, key) },
      { offset: 1, color: slotColor(GAME_PALETTE.playerShades, key) },
    ],
    textureSpace: "local",
  });
  bodyGradients.set(key, gradient);
  return gradient;
}

/** Vertical helmet gradient, white to the shell mixed 10 % toward ink (§ 3 Helmet shading). */
function helmetFill(): FillGradient {
  helmetGradient ??= new FillGradient({
    type: "linear",
    start: { x: 0, y: 0 },
    end: { x: 0, y: 1 },
    colorStops: [
      { offset: 0, color: GAME_PALETTE.gloss },
      { offset: 1, color: GAME_PALETTE.helmetShade },
    ],
    textureSpace: "local",
  });
  return helmetGradient;
}

const inkStroke = (width: number) => ({
  width: width * 2,
  color: GAME_PALETTE.ink,
  join: "round" as const,
});

/** Ink pass of the body (the helmet has its own, so it can wobble on its spring). */
export const drawBodyInk = (g: Graphics, m: BlobMetrics, width: number): Graphics =>
  eggPath(g.clear(), m.r).stroke(inkStroke(width));

export const drawHelmetInk = (g: Graphics, m: BlobMetrics, width: number): Graphics =>
  helmetPath(g.clear(), m).stroke(inkStroke(width));

export const drawFootInk = (g: Graphics, m: BlobMetrics, width: number): Graphics =>
  footPath(g.clear(), m).stroke(inkStroke(width));

export const drawTubeInk = (g: Graphics, u: number, width: number): Graphics =>
  tubePath(g.clear(), u).stroke(inkStroke(width));

/** Fill pass of the body: the gradient egg. */
export const drawBodyFill = (slot: number, m: BlobMetrics): Graphics =>
  eggPath(new Graphics(), m.r).fill(bodyGradient(slot));

/** Hit flash: the egg in flat white, drawn over the body fill; its alpha is set per frame. */
export const drawBodyFlash = (m: BlobMetrics): Graphics =>
  eggPath(new Graphics(), m.r).fill(GAME_PALETTE.hitFlash);

/** Fill pass of the helmet dome: the vertical gradient. */
export const drawHelmetFill = (m: BlobMetrics): Graphics =>
  helmetPath(new Graphics(), m).fill(helmetFill());

/** Gloss oval on the body (0.13 R × 0.22 R, tilted 18°), as its own shape so it can rotate. */
export function drawBodyGloss(m: BlobMetrics): Graphics {
  const gloss = new Graphics()
    .ellipse(0, 0, 0.13 * m.r, 0.22 * m.r)
    .fill({ color: GAME_PALETTE.gloss, alpha: 0.7 });
  gloss.position.set(-0.4 * m.r, 0.08 * m.r);
  gloss.rotation = (18 * Math.PI) / 180;
  return gloss;
}

/** Helmet gloss stroke along the dome and the slot emblem in the player colour, no outlines. */
export function drawHelmetDetails(slot: number, m: BlobMetrics): Graphics[] {
  const { half, top, rim } = m.helmet;
  const { u } = m;
  const gloss = new Graphics()
    .moveTo(-half * 0.6, top + 7 * u)
    .quadraticCurveTo(-half * 0.2, top - u, half * 0.12, top + 2 * u)
    .stroke({ width: 3.5 * u, color: GAME_PALETTE.gloss, alpha: 0.85, cap: "round" });
  const emblem = traceEmblem(new Graphics(), playerEmblemShape(slot, 6.5 * u)).fill(
    slotColor(GAME_PALETTE.players, slot)
  );
  emblem.position.set(0, (top + rim) / 2 + 3 * u);
  return [gloss, emblem];
}

export const drawFootFill = (slot: number, m: BlobMetrics): Graphics =>
  footPath(new Graphics(), m).fill(slotColor(GAME_PALETTE.playerShades, slot));

export const drawTubeFill = (u: number): Graphics =>
  new Graphics()
    .roundRect(-3 * u, -7 * u, 26 * u, 14 * u, 6 * u)
    .fill(GAME_PALETTE.helmet)
    .roundRect(17 * u, -8 * u, 8 * u, 16 * u, 3.5 * u)
    .fill(GAME_PALETTE.helmetEdge);

/** Eye white (5 × 7.5) and pupil (2.8 × 4.2), no outline. */
export function drawEye(u: number): { white: Graphics; pupil: Graphics } {
  const white = new Graphics().ellipse(0, 0, 5 * u, 7.5 * u).fill(GAME_PALETTE.eyeWhite);
  const pupil = new Graphics().ellipse(0, 0, 2.8 * u, 4.2 * u).fill(GAME_PALETTE.ink);
  return { white, pupil };
}
