import { Container, FillGradient, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { traceEmblem } from "@/shared/services/emblemRenderer";
import { traceWeaponTube } from "@/shared/services/weaponTubeRenderer";
import { inkColor } from "@/shared/utils/debugInk";
import { playerEmblemShape } from "@/shared/utils/playerEmblem";
import { weaponTubeParts, type WeaponTubeParts } from "@/shared/utils/weaponTube";
import type { WeaponItemId } from "@/shared/types/weaponItems.types";

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

/** A point in torso space (body centre origin, y down). */
export type ShapePoint = readonly [x: number, y: number];

/** One cubic curve: start, two controls, end. */
export type CubicSegment = readonly [ShapePoint, ShapePoint, ShapePoint, ShapePoint];

/** The egg's four cubic curves (shared by `eggPath` and the crouch outline). */
export function eggSegments(r: number): CubicSegment[] {
  const t = r;
  const b = r * 0.94;
  const k = 0.56 * 1.05;
  return [
    [
      [0, -t],
      [r * k, -t],
      [r, -t * 0.52],
      [r, b * 0.08],
    ],
    [
      [r, b * 0.08],
      [r, b * 0.66],
      [r * 0.6, b],
      [0, b],
    ],
    [
      [0, b],
      [-r * 0.6, b],
      [-r, b * 0.66],
      [-r, b * 0.08],
    ],
    [
      [-r, b * 0.08],
      [-r, -t * 0.52],
      [-r * k, -t],
      [0, -t],
    ],
  ];
}

/** Soft egg from four cubic curves: widest a little below the middle, fuller at the bottom. */
export function eggPath(g: Graphics, r: number): Graphics {
  const segments = eggSegments(r);
  g.moveTo(...segments[0]![0]);
  for (const [, c1, c2, end] of segments) g.bezierCurveTo(...c1, ...c2, ...end);
  return g.closePath();
}

/** A closed outline through `points` (the crouched body). */
export function outlinePath(g: Graphics, points: readonly ShapePoint[]): Graphics {
  g.moveTo(...points[0]!);
  for (let i = 1; i < points.length; i += 1) g.lineTo(...points[i]!);
  return g.closePath();
}

/** The body's path: the egg, or the crouch's reshaped outline when one is given. */
const bodyPath = (g: Graphics, m: BlobMetrics, outline?: readonly ShapePoint[]): Graphics =>
  outline ? outlinePath(g, outline) : eggPath(g, m.r);

/** The dome's cubic curve from the left rim corner to the right one (torso space). */
export function helmetDome(m: BlobMetrics): CubicSegment {
  const { half, top, rim } = m.helmet;
  const peak = top - 8 * m.u;
  return [
    [-half, rim],
    [-half, peak],
    [half, peak],
    [half, rim],
  ];
}

/** Helmet dome over the top of the body, with a slightly curved rim. */
export function helmetPath(g: Graphics, m: BlobMetrics): Graphics {
  const [start, c1, c2, end] = helmetDome(m);
  return g
    .moveTo(...start)
    .bezierCurveTo(...c1, ...c2, ...end)
    .quadraticCurveTo(0, m.helmet.rim + 7 * m.u, ...start)
    .closePath();
}

/** Height of a foot's centre above its ground point, mockup units (the foot turns around it). */
export const FOOT_CENTRE_UNITS = 6;

/** One foot (0.4 R × 0.25 R), centred `FOOT_CENTRE_UNITS` above its ground point. */
export const footPath = (g: Graphics, m: BlobMetrics): Graphics =>
  g.ellipse(0, -FOOT_CENTRE_UNITS * m.u, 12 * m.u, 7.5 * m.u);

const slotColor = (colors: readonly number[], slot: number): number =>
  colors[slot % colors.length] ?? GAME_PALETTE.ink;

const bodyGradients = new Map<number, FillGradient>();

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

/** Where the weapon barrel pivots: the middle of the helmet, under the emblem (torso space). */
export const helmetCentreY = (m: BlobMetrics): number =>
  (m.helmet.top + m.helmet.rim) / 2 + 3 * m.u;

const inkStroke = (width: number) => ({
  width: width * 2,
  color: inkColor("blobs"),
  join: "round" as const,
});

/** Ink pass of the body (the helmet has its own, so it can wobble on its spring). */
export const drawBodyInk = (
  g: Graphics,
  m: BlobMetrics,
  look: { width: number; outline?: readonly ShapePoint[] }
): Graphics => bodyPath(g.clear(), m, look.outline).stroke(inkStroke(look.width));

export const drawHelmetInk = (g: Graphics, m: BlobMetrics, width: number): Graphics =>
  helmetPath(g.clear(), m).stroke(inkStroke(width));

export const drawFootInk = (g: Graphics, m: BlobMetrics, width: number): Graphics =>
  footPath(g.clear(), m).stroke(inkStroke(width));

/** Ink pass of a weapon's helmet tube (DESIGN_LANGUAGE § 9: the silhouette names the weapon). */
export const drawTubeInk = (g: Graphics, tube: WeaponTubeParts, width: number): Graphics =>
  traceWeaponTube(g.clear(), tube.parts).stroke(inkStroke(width));

/** Fill pass of the body: the gradient egg. */
export const drawBodyFill = (
  g: Graphics,
  m: BlobMetrics,
  look: { slot: number; outline?: readonly ShapePoint[] }
): Graphics => bodyPath(g.clear(), m, look.outline).fill(bodyGradient(look.slot));

/** Hit flash: the body in flat white, drawn over the body fill; its alpha is set per frame. */
export const drawBodyFlash = (
  g: Graphics,
  m: BlobMetrics,
  outline?: readonly ShapePoint[]
): Graphics => bodyPath(g.clear(), m, outline).fill(GAME_PALETTE.hitFlash);

/** Fill pass of the helmet dome: flat cream, the same fill as the weapon barrel (§ 3, § 9). */
export const drawHelmetFill = (m: BlobMetrics): Graphics =>
  helmetPath(new Graphics(), m).fill(GAME_PALETTE.helmet);

/** Gloss oval on the body (0.13 R × 0.22 R, tilted 18°), as its own shape so it can rotate. */
export function drawBodyGloss(m: BlobMetrics): Graphics {
  const gloss = new Graphics()
    .ellipse(0, 0, 0.13 * m.r, 0.22 * m.r)
    .fill({ color: GAME_PALETTE.gloss, alpha: 0.7 });
  gloss.position.set(-0.4 * m.r, 0.08 * m.r);
  gloss.rotation = (18 * Math.PI) / 180;
  return gloss;
}

/** The helmet glint: one curved stroke under the dome's top-left (torso space, helmet unsunk). */
export function helmetGlint(m: BlobMetrics): {
  start: ShapePoint;
  control: ShapePoint;
  end: ShapePoint;
  width: number;
} {
  const { half, top } = m.helmet;
  const { u } = m;
  // Shorter and lower than the first cut, so it never comes near the dome's outline (owner,
  // crouch-sink D5): the dome's curve peaks under `top` and falls away fast at the sides.
  return {
    start: [-half * 0.5, top + 12 * u],
    control: [-half * 0.2, top + 5 * u],
    end: [half * 0.06, top + 7 * u],
    width: 3.5 * u,
  };
}

/** Helmet gloss stroke along the dome and the slot emblem in the player colour, no outlines. */
export function drawHelmetDetails(slot: number, m: BlobMetrics): Graphics[] {
  const glint = helmetGlint(m);
  const gloss = new Graphics()
    .moveTo(...glint.start)
    .quadraticCurveTo(...glint.control, ...glint.end)
    .stroke({ width: glint.width, color: GAME_PALETTE.gloss, alpha: 0.85, cap: "round" });
  const emblem = traceEmblem(new Graphics(), playerEmblemShape(slot, 6.5 * m.u)).fill(
    slotColor(GAME_PALETTE.players, slot)
  );
  emblem.position.set(0, helmetCentreY(m));
  return [gloss, emblem];
}

export const drawFootFill = (slot: number, m: BlobMetrics): Graphics =>
  footPath(new Graphics(), m).fill(slotColor(GAME_PALETTE.playerShades, slot));

/**
 * Fill pass of a weapon's barrel: the barrel in the helmet's cream, so helmet and barrel read as
 * one piece, and the mouth in its pale resting colour (weapon-visuals-embellish D2, D7).
 */
export const drawTubeFill = (g: Graphics, tube: WeaponTubeParts): Graphics => {
  traceWeaponTube(g.clear(), tube.parts, "barrel").fill(GAME_PALETTE.helmet);
  return traceWeaponTube(g, tube.parts, "mouth").fill(GAME_PALETTE.mouthPale);
};

/**
 * Mouth ready light (weapon-visuals-embellish D7): the mouth parts in the weapon accent, no
 * outline of their own. The renderer sets the alpha from the shot cooldown: faded over the pale
 * mouth while recharging, full when ready.
 */
export const drawMouthLight = (g: Graphics, tube: WeaponTubeParts, accent: number): Graphics =>
  traceWeaponTube(g.clear(), tube.parts, "mouth").fill(accent);

/** Eye white (5 × 7.5) and pupil (2.8 × 4.2), no outline. */
export function drawEye(u: number): { white: Graphics; pupil: Graphics } {
  const white = new Graphics().ellipse(0, 0, 5 * u, 7.5 * u).fill(GAME_PALETTE.eyeWhite);
  const pupil = new Graphics().ellipse(0, 0, 2.8 * u, 4.2 * u).fill(GAME_PALETTE.ink);
  return { white, pupil };
}

/**
 * A helmet off the blob (knockout): ink pass, gradient dome, gloss and emblem in one container,
 * centred on the dome so it can spin as a loose piece.
 */
export function drawLooseHelmet(slot: number, height: number, width: number): Container {
  const m = blobMetrics(height);
  const piece = new Container();
  piece.addChild(
    drawHelmetInk(new Graphics(), m, width),
    drawHelmetFill(m),
    ...drawHelmetDetails(slot, m)
  );
  piece.pivot.set(0, (m.helmet.top + m.helmet.rim) / 2);
  return piece;
}

/** A weapon barrel off the helmet (knockout): its silhouette with the mouth lit. */
export function drawLooseTube(itemId: WeaponItemId, height: number, width: number): Container {
  const { u } = blobMetrics(height);
  const look = weaponLook(itemId);
  const tube = weaponTubeParts(look.tube, u);
  const piece = new Container();
  piece.addChild(
    drawTubeInk(new Graphics(), tube, width),
    drawTubeFill(new Graphics(), tube),
    drawMouthLight(new Graphics(), tube, look.accent)
  );
  return piece;
}
