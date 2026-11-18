import { Container, Graphics } from "pixi.js";
import { inkColor } from "@/shared/utils/debugInk";
import { contactShadow, CONTACT_SHADOW_RANGE } from "@/shared/utils/contactShadow";
import { syncDisplayById } from "@/shared/utils/displaySync";

/**
 * A render layer of contact shadows (DESIGN_LANGUAGE § 4) under airborne props: one ink ellipse
 * per caster on the first surface below, sized by `contactShadow`. Used by combat (rockets) and
 * collectibles (falling weapon crates). The caller supplies the ground lookup (arena terrain).
 */
export interface ShadowCaster {
  key: string;
  x: number;
  /** Bottom of the object (world y). */
  y: number;
  width: number;
}

/** Top of the first surface below a span, or null when there is none within `range`. */
export type GroundBelow = (span: {
  x: number;
  y: number;
  w: number;
  range: number;
}) => number | null;

export interface ContactShadowLayer {
  container: Container;
  sprites: Map<string, Container>;
}

export const createContactShadowLayer = (label: string): ContactShadowLayer => ({
  container: new Container({ label }),
  sprites: new Map(),
});

/** Matches the layer to this frame's casters. */
export function syncContactShadows(
  layer: ContactShadowLayer,
  frame: { casters: readonly ShadowCaster[]; groundBelow: GroundBelow }
): void {
  syncDisplayById(layer.sprites, layer.container, {
    list: frame.casters,
    key: (caster) => caster.key,
    create: () => new Graphics().ellipse(0, 0, 1, 1).fill(inkColor("other")),
    place: (sprite, caster) => {
      const span = { x: caster.x - 2, y: caster.y, w: 4, range: CONTACT_SHADOW_RANGE };
      const ground = frame.groundBelow(span);
      const shadow = ground === null ? null : contactShadow(ground - caster.y, caster.width);
      sprite.visible = shadow !== null;
      if (!shadow || ground === null) return;
      sprite.position.set(caster.x, ground);
      sprite.scale.set(shadow.width / 2, shadow.height / 2);
      sprite.alpha = shadow.alpha;
    },
  });
}
