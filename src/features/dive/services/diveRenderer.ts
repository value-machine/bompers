import { Container, Graphics, Text } from "pixi.js";
import { GAME_PALETTE } from "@/shared/config/gamePalette";
import type { GameTunables } from "@/shared/types/gameTunables.types";
import type { BlobPoseOverlay, PlayerState } from "@/features/player/api/playerApi";
import type { DiveState, HitTally } from "@/features/dive/types/dive.types";
import { activeDiveOption } from "@/features/dive/services/diveSim";
import { diveBlobPose } from "@/features/dive/services/divePose";

/**
 * Dive render pieces: an effects layer (impact rings, world units, drawn under the players per
 * DESIGN_LANGUAGE § 5), the pose overlays the player layer applies, and the phase-1 prototype
 * overlay text (active option + hit tally, screen units).
 */
export interface DiveView {
  /** World layer: impact rings. */
  effects: Container;
  rings: Graphics[];
  /** Screen layer: prototype overlay. */
  overlay: Text;
}

/** How long a ring lives and how far it grows (must match the sim's recent-hit window). */
const RING_SECONDS = 0.25;
const RING_RADIUS = { from: 10, to: 46 };

export function createDiveView(): DiveView {
  const overlay = new Text({
    text: "",
    style: { fill: GAME_PALETTE.ink, fontSize: 16, fontFamily: "monospace", lineHeight: 20 },
  });
  return { effects: new Container({ label: "dive-effects" }), rings: [], overlay };
}

/** Pose overlays by player id for `syncPlayersView`. */
export function diveBlobPoses(
  dive: DiveState,
  tunables: GameTunables
): Map<string, BlobPoseOverlay> {
  const option = activeDiveOption(dive, tunables);
  const poses = new Map<string, BlobPoseOverlay>();
  for (const [id, motion] of Object.entries(dive.motions)) {
    const pose = diveBlobPose(motion, { option, staggerSeconds: tunables.dive.staggerSeconds });
    if (pose) poses.set(id, pose);
  }
  return poses;
}

function ringAt(view: DiveView, index: number): Graphics {
  const existing = view.rings[index];
  if (existing) return existing;
  const ring = new Graphics();
  view.rings.push(ring);
  view.effects.addChild(ring);
  return ring;
}

/** One expanding, thinning ring per recent hit; back hits are bigger and yellow. */
function syncRings(view: DiveView, dive: DiveState): void {
  dive.recentHits.forEach(({ hit, ageSeconds }, index) => {
    const t = Math.min(1, ageSeconds / RING_SECONDS);
    const strong = hit.zone === "back";
    const radius =
      (RING_RADIUS.from + (RING_RADIUS.to - RING_RADIUS.from) * t) * (strong ? 1.4 : 1);
    ringAt(view, index)
      .clear()
      .circle(hit.contactPoint.x, hit.contactPoint.y, radius)
      .fill({
        color: strong ? GAME_PALETTE.hitStrong : GAME_PALETTE.hitFlash,
        alpha: 0.9 * (1 - t),
      })
      .stroke({ width: 5 * (1 - t) + 1, color: GAME_PALETTE.ink, alpha: 1 - t });
    ringAt(view, index).visible = true;
  });
  for (let i = dive.recentHits.length; i < view.rings.length; i += 1)
    view.rings[i]!.visible = false;
}

function tallyLine(player: PlayerState, tally: HitTally | undefined): string {
  const t = tally ?? { dealt: 0, frontTaken: 0, backTaken: 0, damageTaken: 0 };
  const taken = t.frontTaken + t.backTaken;
  return (
    `P${player.slot + 1}  dealt ${t.dealt}  taken ${taken} ` +
    `(front ${t.frontTaken}, back ${t.backTaken})  damage ${t.damageTaken}`
  );
}

function overlayText(dive: DiveState, players: readonly PlayerState[], tunables: GameTunables) {
  const option = activeDiveOption(dive, tunables);
  const keys = tunables.dive.options.map((entry, i) => `${i + 1} ${entry.name}`).join(" · ");
  const lines = [`Bomp: ${option.name}   (keys: ${keys})`];
  for (const player of players) lines.push(tallyLine(player, dive.tallies[player.slot]));
  return lines.join("\n");
}

/** Draws the dive effects and overlay for the latest state. Call once per rendered frame. */
export function syncDiveView(
  view: DiveView,
  frame: { dive: DiveState; players: readonly PlayerState[]; tunables: GameTunables }
): void {
  syncRings(view, frame.dive);
  const text = overlayText(frame.dive, frame.players, frame.tunables);
  if (view.overlay.text !== text) view.overlay.text = text;
}
