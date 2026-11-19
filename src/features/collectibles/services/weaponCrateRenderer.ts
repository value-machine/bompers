import { Container, Graphics } from "pixi.js";
import { GAME_PALETTE, weaponLook } from "@/shared/config/gamePalette";
import { traceWeaponTube } from "@/shared/services/weaponTubeRenderer";
import { weaponTubeMark } from "@/shared/utils/weaponTube";
import { WEAPON_CRATE_SHAPE } from "@/shared/utils/weaponCrate";
import { syncContactShadows, type ContactShadowLayer } from "@/shared/utils/contactShadowLayer";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { surfaceBelow, type TerrainGrid } from "@/features/arena/api/arenaApi";
import type { WeaponCrate } from "@/features/collectibles/types/collectibles.types";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { blendPose, easeOutQuad, popInScale, springBackPose } from "@/shared/utils/easing";

/**
 * Weapon-crate layers (DESIGN_LANGUAGE § 1 Effects, § 4 shadows, § 9 Weapon identity): a crate in
 * its weapon's accent showing the weapon's mouth, and the contact shadow of a falling crate.
 * Crates are keyed by item and outline step, so they rebuild only when the zoom-clamped width
 * step changes. Juice (GAME_JUICE § 6, pickup-juice D2): a crate pops in at its drop point,
 * stretches tall while it falls (by fall speed), squashes wide when it lands and throws two dust
 * puffs; all from the crate's sim state.
 */
export interface CrateLayers {
  crates: Container;
  crateSprites: Map<string, Container>;
  shadows: ContactShadowLayer;
}

export interface CrateFrame {
  crates: readonly WeaponCrate[];
  size: number;
  /** Zoom-clamped prop outline. */
  outline: { width: number; step: number };
  /** Terrain the contact shadows fall on. */
  terrain: TerrainGrid;
  /** Pickup juice timings and poses (`feel.pickup`). */
  feel: GameTunables["feel"]["pickup"];
}

const {
  cornerRadius: CORNER,
  markTilt: MARK_TILT,
  markUnits: MARK_UNITS,
  markOutline: MARK_OUTLINE,
  gloss: GLOSS,
} = WEAPON_CRATE_SHAPE;

interface CrateLook {
  itemId: WeaponCrate["itemId"];
  size: number;
  width: number;
}

/**
 * Crate that shows what it holds (weapon-visuals-embellish D9, D10): the whole crate in the
 * weapon accent, the weapon's mouth centred on it in ink inside a white outline, and one white
 * gloss oval. Origin bottom-centre.
 */
function drawCrate({ itemId, size, width }: CrateLook): Container {
  const half = size / 2;
  const look = weaponLook(itemId);
  const crate = new Container();
  const box = new Graphics()
    .roundRect(-half, -size, size, size, size * CORNER)
    .fill(look.accent)
    .stroke({ width, color: GAME_PALETTE.ink, join: "round" });
  const gloss = new Graphics()
    .ellipse(0, 0, size * GLOSS.rx, size * GLOSS.ry)
    .fill({ color: GAME_PALETTE.gloss, alpha: GLOSS.alpha });
  gloss.position.set(size * GLOSS.x, size * GLOSS.y);
  gloss.rotation = GLOSS.tilt;
  const { parts, centre } = weaponTubeMark(look.tube, size / MARK_UNITS);
  // Two passes of the same shapes, like the blob's ink: white stroked wide underneath, ink on top.
  const mark = traceWeaponTube(new Graphics(), parts)
    .fill(GAME_PALETTE.crateMarkOutline)
    .stroke({
      width: size * MARK_OUTLINE * 2,
      color: GAME_PALETTE.crateMarkOutline,
      join: "round",
    });
  traceWeaponTube(mark, parts).fill(GAME_PALETTE.ink);
  mark.pivot.set(centre.x, centre.y);
  mark.position.set(0, -half);
  mark.rotation = MARK_TILT;
  crate.addChild(box, gloss, mark);
  return crate;
}

interface CrateSprite extends Container {
  body: Container;
  dust: Graphics[];
}

/** The crate plus two dust puffs at its feet (hidden until it lands). */
function drawCrateSprite(look: CrateLook): CrateSprite {
  const body = drawCrate(look);
  const r = look.size * 0.22;
  const dust = [-1, 1].map(() =>
    new Graphics()
      .circle(0, 0, r)
      .fill(GAME_PALETTE.pickupDust)
      .stroke({ width: look.width * 0.6, color: GAME_PALETTE.ink })
  );
  const root = new Container() as CrateSprite;
  root.addChild(...dust, body);
  return Object.assign(root, { body, dust });
}

/** Pop-in, fall stretch or landing squash, and the dust puffs rolling out after a landing. */
function placeCrate(sprite: CrateSprite, crate: WeaponCrate, frame: CrateFrame): void {
  const { feel, size } = frame;
  sprite.position.set(crate.x, crate.y);
  const stretch = Math.min(1, crate.vy / feel.fallStretch.fullSpeed);
  const pose = crate.grounded
    ? springBackPose(feel.settle, crate.groundedSeconds / feel.settle.seconds)
    : blendPose(feel.fallStretch, stretch);
  const pop = popInScale(crate.ageSeconds / feel.popInSeconds);
  sprite.body.scale.set(pose.sx * pop, pose.sy * pop);
  const t = crate.grounded ? crate.groundedSeconds / feel.dustSeconds : 1;
  const out = easeOutQuad(Math.min(1, t));
  sprite.dust.forEach((puff, index) => {
    const side = index === 0 ? -1 : 1;
    puff.visible = t < 1;
    puff.position.set(side * size * (0.55 + 0.7 * out), -size * (0.18 + 0.15 * t));
    puff.scale.set(1 - t * 0.4);
    puff.alpha = 1 - t;
  });
}

/** Matches the crate and crate-shadow layers to the current crates. */
export function syncCrateLayers(layers: CrateLayers, frame: CrateFrame): void {
  const { crates, size, outline } = frame;
  syncDisplayById(layers.crateSprites, layers.crates, {
    list: crates,
    key: (crate) => `${crate.id}:${crate.itemId}:${outline.step}`,
    create: (crate) => drawCrateSprite({ itemId: crate.itemId, size, width: outline.width }),
    place: (sprite, crate) => placeCrate(sprite as CrateSprite, crate, frame),
  });
  syncContactShadows(layers.shadows, {
    casters: crates
      .filter((crate) => !crate.grounded)
      .map((crate) => ({ key: `c${crate.id}`, x: crate.x, y: crate.y, width: size })),
    groundBelow: (span) => surfaceBelow(frame.terrain, span),
  });
}
