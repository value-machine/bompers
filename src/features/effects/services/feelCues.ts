import type { GameTunables } from "@/shared/config/gameTunables";
import { kickCameraShake, type CameraShake } from "@/features/camera/api/cameraApi";
import type { CombatEvent } from "@/features/combat/api/combatApi";

/**
 * Game-feel cues (DESIGN_LANGUAGE § 6): reads the new combat events (by `seq`) and the players'
 * roll-bounce counters once per rendered frame and turns them into render-only feedback —
 * camera-shake kicks, per-player hit flashes (with the side the hit came from, for the helmet
 * wobble), and a short hit-stop after hard hits. Wall-clock based, like the blob squash; it never
 * writes game state. Per frame it mutates its own state and allocates only when a hit is new.
 */
export type FeelTunables = GameTunables["feel"];

/** The slice of a player this reads (structural, so effects needs no player import). */
export interface FeelBody {
  id: string;
  slot: number;
  x: number;
  rollBounceCount: number;
  lastRollBounceSpeed: number;
}

export interface PlayerHitFeel {
  /** When the newest hit landed (render clock, ms); a new value means a new hit. */
  startMs: number;
  /** −1 / 1: the hit pushed toward −x / +x (helmet tilts that way); 0 = straight on. */
  dirX: number;
  /** Back hit (more damage, a longer roll): stronger flash and shake, hit-stop. */
  hard: boolean;
  /** Flash alpha to draw this frame (0 = none). */
  flash: number;
  /** Chunks the newest hit took (the hurt pose and the flying chunks). */
  damage: number;
}

export interface FeelState {
  lastSeq: number;
  seenBounces: Map<string, number>;
  hits: Map<string, PlayerHitFeel>;
  /** Render clock (ms) until which the world view stays frozen. */
  hitStopUntilMs: number;
}

export interface FeelFrame {
  events: readonly CombatEvent[];
  bodies: readonly FeelBody[];
  nowMs: number;
  feel: FeelTunables;
  /** Blast radius that shakes at full `shake.explosion.px`. */
  fullBlastRadius: number;
  reducedMotion: boolean;
  shake: CameraShake;
}

export const createFeelState = (): FeelState => ({
  lastSeq: -1,
  seenBounces: new Map(),
  hits: new Map(),
  hitStopUntilMs: 0,
});

/** Flash alpha `ageMs` after a hit: full for the hold, then a linear fade (0 after it). */
export function hitFlashAmount(
  ageMs: number,
  hit: { hard: boolean; reducedMotion: boolean },
  flash: FeelTunables["hitFlash"]
): number {
  const holdMs = flash.holdSeconds * 1000;
  const fadeMs = flash.fadeSeconds * 1000;
  if (ageMs < 0 || ageMs >= holdMs + fadeMs) return 0;
  const peak =
    (hit.hard ? flash.back : flash.front) * (hit.reducedMotion ? flash.reducedMotionScale : 1);
  if (ageMs < holdMs) return peak;
  return peak * (1 - (ageMs - holdMs) / fadeMs);
}

type HitEvent = Extract<CombatEvent, { type: "playerHit" }>;

/** The hit's screen shake, and on a hard hit the hit-stop. */
function kickHitScreen(state: FeelState, { hard, frame }: { hard: boolean; frame: FeelFrame }) {
  const { feel, nowMs } = frame;
  const shake = feel.shake.hit;
  kickCameraShake(frame.shake, {
    px: shake.px * (hard ? feel.shake.hardHitScale : 1),
    seconds: shake.seconds,
    nowMs,
  });
  if (hard && feel.hitStop.seconds > 0) {
    state.hitStopUntilMs = Math.max(state.hitStopUntilMs, nowMs + feel.hitStop.seconds * 1000);
  }
}

function noteHit(state: FeelState, event: HitEvent, frame: FeelFrame): void {
  const { nowMs } = frame;
  // A hit that takes nothing (crouched) is blocked: no flash, shake or hurt (owner, hurt-feedback D1).
  if (event.damage === 0) return;
  // A shattered ice block lands as hard as a back hit (freeze-ray buff B: heavy tier).
  const hard = event.zone === "back" || event.bonus === true;
  kickHitScreen(state, { hard, frame });
  const victim = frame.bodies.find((body) => body.slot === event.victimSlot);
  if (!victim) return;
  const dirX = Math.sign(victim.x - event.x);
  const existing = state.hits.get(victim.id);
  if (existing) {
    existing.startMs = nowMs;
    existing.dirX = dirX;
    existing.hard = hard || (existing.hard && existing.flash > 0);
    existing.damage = event.damage;
  } else {
    state.hits.set(victim.id, { startMs: nowMs, dirX, hard, flash: 0, damage: event.damage });
  }
}

function noteEvents(state: FeelState, frame: FeelFrame): void {
  const { feel, nowMs } = frame;
  for (const event of frame.events) {
    if (event.seq <= state.lastSeq) continue;
    state.lastSeq = event.seq;
    if (event.type === "playerHit") noteHit(state, event, frame);
    if (event.type === "playerEliminated" && event.cause === "crush") {
      // Heavy tier, like a back hit (a crush has no hit of its own; moving-parts B3).
      kickCameraShake(frame.shake, {
        px: feel.shake.hit.px * feel.shake.hardHitScale,
        seconds: feel.shake.hit.seconds,
        nowMs,
      });
    }
    if (event.type === "explosion") {
      const scale = Math.min(1.5, event.radius / frame.fullBlastRadius);
      kickCameraShake(frame.shake, {
        px: feel.shake.explosion.px * scale,
        seconds: feel.shake.explosion.seconds,
        nowMs,
      });
    }
  }
}

function noteRollBounces(state: FeelState, frame: FeelFrame): void {
  const { rollBounce } = frame.feel.shake;
  for (const body of frame.bodies) {
    const seen = state.seenBounces.get(body.id);
    state.seenBounces.set(body.id, body.rollBounceCount);
    if (seen === undefined || seen === body.rollBounceCount) continue;
    kickCameraShake(frame.shake, {
      px: rollBounce.px * Math.min(1, body.lastRollBounceSpeed / rollBounce.fullSpeed),
      seconds: rollBounce.seconds,
      nowMs: frame.nowMs,
    });
  }
}

/** Reads this frame's new events into shake kicks, hits and hit-stop; updates flash alphas. */
export function readFeelCues(state: FeelState, frame: FeelFrame): void {
  noteEvents(state, frame);
  noteRollBounces(state, frame);
  for (const hit of state.hits.values()) {
    hit.flash = hitFlashAmount(
      frame.nowMs - hit.startMs,
      { hard: hit.hard, reducedMotion: frame.reducedMotion },
      frame.feel.hitFlash
    );
  }
}
