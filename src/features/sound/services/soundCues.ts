import { intensityGain } from "@/shared/config/gameJuice";
import type { CombatEvent } from "@/features/combat/api/combatApi";
import { SOUND_MIX } from "@/features/sound/services/soundBank";
import type { SoundCue, SoundPlayerSnapshot } from "@/features/sound/types/sound.types";

/** Everything the cue reader needs from one frame of the match. */
export interface SoundSnapshot {
  players: readonly SoundPlayerSnapshot[];
  /** Combat's event log (read by `seq`). */
  events: readonly CombatEvent[];
  roundPhase: "playing" | "ended";
}

/** What the reader remembers between frames. A fresh round starts from `null`. */
export interface SoundCursor {
  lastSeq: number;
  players: ReadonlyMap<number, SoundPlayerSnapshot>;
  roundPhase: "playing" | "ended";
}

/**
 * Turns one frame of the match into sound cues: combat events by `seq` (combat D3), the
 * players' monotonic event counters (jump, land, tumble bounce), dive phase changes, respawns
 * and the round phase. Pure: the caller keeps the returned cursor for the next frame, and a
 * fresh round starts from a `null` cursor (which cues the round start).
 */
export function readSoundCues(
  cursor: SoundCursor | null,
  frame: SoundSnapshot
): { cursor: SoundCursor; cues: SoundCue[] } {
  const lastSeq = cursor?.lastSeq ?? 0;
  const cues = [
    ...roundCues(cursor, frame),
    ...frame.players.flatMap((player) => playerCues(cursor?.players.get(player.slot), player)),
    ...eventCues(frame, lastSeq),
  ];
  return {
    cues,
    cursor: {
      lastSeq: frame.events.reduce((max, event) => Math.max(max, event.seq), lastSeq),
      players: new Map(frame.players.map((player) => [player.slot, player])),
      roundPhase: frame.roundPhase,
    },
  };
}

const cue = (soundId: string, slot: number | null, gain = 1): SoundCue => ({ soundId, slot, gain });

function roundCues(cursor: SoundCursor | null, frame: SoundSnapshot): SoundCue[] {
  if (cursor === null) return [cue("round-start", null)];
  const ended = cursor.roundPhase === "playing" && frame.roundPhase === "ended";
  return ended ? [cue("round-end", null)] : [];
}

/**
 * The blob part of a head-on wall bonk: the landing splut (owner's swap, material-sounds D5).
 * Dive hits on another player keep `dive-impact`.
 */
export const WALL_BONK_SOUND = "land";

type PlayerRule = (previous: SoundPlayerSnapshot, now: SoundPlayerSnapshot) => boolean;

/** Player-state changes that cue a sound, in play order, with each one's gain. */
const PLAYER_RULES: readonly [
  soundId: string,
  fired: PlayerRule,
  gain: (now: SoundPlayerSnapshot) => number,
][] = [
  ["jump", (p, n) => n.jumpCount > p.jumpCount || n.wallJumpCount > p.wallJumpCount, () => 1],
  [
    "land",
    (p, n) => n.landCount > p.landCount,
    (n) => intensityGain(n.lastLandingSpeed, SOUND_MIX.landingFullSpeed),
  ],
  ["tumble-bounce", (p, n) => n.tumbleBounceCount > p.tumbleBounceCount, () => 1],
  ["dive-launch", (p, n) => n.divePhase === "travel" && p.divePhase !== "travel", () => 1],
  ["respawn", (p, n) => n.inPlay && !p.inPlay, () => 1],
];

const bonked = (previous: SoundPlayerSnapshot, now: SoundPlayerSnapshot): boolean =>
  now.divePhase === "recovery" && now.diveBonked && previous.divePhase === "travel";

/**
 * A head-on wall bonk: the blob's splut (pitched) plus the wall's material sound (unpitched),
 * both as loud as the bonk was hard.
 */
function bonkCues(now: SoundPlayerSnapshot): SoundCue[] {
  const gain = intensityGain(now.terrainHitSpeed, SOUND_MIX.hitFullSpeed);
  const cues = [cue(WALL_BONK_SOUND, now.slot, gain)];
  if (now.diveBonkSoundId !== "none") cues.push(cue(now.diveBonkSoundId, null, gain));
  return cues;
}

function playerCues(
  previous: SoundPlayerSnapshot | undefined,
  now: SoundPlayerSnapshot
): SoundCue[] {
  if (!previous) return [];
  const cues = PLAYER_RULES.filter(([, fired]) => fired(previous, now)).map(([soundId, , gain]) =>
    cue(soundId, now.slot, gain(now))
  );
  if (bonked(previous, now)) cues.push(...bonkCues(now));
  // Sinking into a crouch is a soft landing thud (no file of its own).
  if (now.crouchCount > previous.crouchCount)
    cues.push(cue("land", now.slot, SOUND_MIX.crouchGain));
  return cues;
}

function eventCues(frame: SoundSnapshot, lastSeq: number): SoundCue[] {
  const speedOf = (slot: number): number =>
    frame.players.find((player) => player.slot === slot)?.speed ?? 0;
  return frame.events
    .filter((event) => event.seq > lastSeq)
    .map((event) => combatEventCue(event, speedOf))
    .filter((eventCue): eventCue is SoundCue => eventCue !== null);
}

/**
 * Combat event → cue. Hits and eliminations take the victim's pitch, actions the actor's. A hit is
 * as loud as the victim's knockback speed this frame (`hitFullSpeed`).
 */
function combatEventCue(event: CombatEvent, speedOf: (slot: number) => number): SoundCue | null {
  switch (event.type) {
    case "playerHit":
      return cue(
        event.source === "dive" ? "dive-impact" : "hit",
        event.victimSlot,
        intensityGain(speedOf(event.victimSlot), SOUND_MIX.hitFullSpeed)
      );
    case "playerEliminated":
      return cue("elimination", event.victimSlot);
    case "rocketFired":
      return cue("rocket-fire", event.slot);
    case "explosion":
      return cue("explosion", null);
    case "pickupCollected":
      return cue("pickup", event.slot);
    case "terrainDestroyed":
      return cue(event.soundId, null);
    case "pickupSpawned":
      return null;
  }
}
