import { Container } from "pixi.js";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import { syncDisplayById } from "@/shared/utils/displaySync";
import { outlineWidth, type OutlineWidth } from "@/shared/utils/outlineWidth";
import {
  drawDiveRefill,
  placeDiveRefill,
} from "@/features/fixed-pickups/services/diveRefillRenderer";
import { fixedPickupRule } from "@/features/fixed-pickups/services/fixedPickups";
import type { PlaceFixedPickupArgs } from "@/features/fixed-pickups/services/fixedPickupPhase";
import {
  drawHealthPickup,
  placeHealthPickup,
} from "@/features/fixed-pickups/services/healthPickupRenderer";
import type {
  FixedPickup,
  FixedPickupItem,
} from "@/features/fixed-pickups/types/fixedPickups.types";

/**
 * View layer of the fixed pickups (beside the point orbs): one sprite per pickup, drawn by its
 * item's look and placed from its sim timers. Adding a fixed pickup item means one entry here.
 */
interface FixedPickupLook {
  draw: (size: number, outline: OutlineWidth) => Container;
  place: (sprite: Container, pickup: FixedPickup, args: PlaceFixedPickupArgs) => void;
}

const LOOKS: Readonly<Record<FixedPickupItem, FixedPickupLook>> = {
  "dive-reset": { draw: drawDiveRefill, place: placeDiveRefill },
  health: { draw: drawHealthPickup, place: placeHealthPickup },
};

export interface FixedPickupsView {
  container: Container;
  sprites: Map<string, Container>;
}

export const createFixedPickupsView = (): FixedPickupsView => ({
  container: new Container({ label: "fixed-pickups" }),
  sprites: new Map(),
});

export interface FixedPickupsFrame {
  pickups: readonly FixedPickup[];
  tunables: GameTunables;
  /** Animation clock, ms. */
  nowMs: number;
  /** Camera zoom (screen px per world unit) for the outline width clamp. */
  zoom: number;
}

/** Matches the layer to the level's fixed pickups. Call once per rendered frame. */
export function syncFixedPickupsView(view: FixedPickupsView, frame: FixedPickupsFrame): void {
  const outline = outlineWidth("prop", frame.zoom);
  syncDisplayById(view.sprites, view.container, {
    list: frame.pickups,
    key: (pickup) => `${pickup.itemId}:${pickup.pointIndex}:${outline.step}`,
    create: (pickup) =>
      LOOKS[pickup.itemId].draw(fixedPickupRule(frame.tunables, pickup.itemId).size, outline),
    place: (sprite, pickup) =>
      LOOKS[pickup.itemId].place(sprite, pickup, {
        respawnSeconds: fixedPickupRule(frame.tunables, pickup.itemId).respawnSeconds,
        nowMs: frame.nowMs,
      }),
  });
}
