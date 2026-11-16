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
    ...eventCues(frame.events, lastSeq),
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

/** Landing gain grows with fall speed, from `minLandingGain` up to 1. */
const landingGain = (speed: number): number => {
  const { fullLandingSpeed, minLandingGain } = SOUND_MIX;
  const t = Math.min(1, Math.max(0, speed / fullLandingSpeed));
  return minLandingGain + (1 - minLandingGain) * t;
};

type PlayerRule = (previous: SoundPlayerSnapshot, now: SoundPlayerSnapshot) => boolean;

/** Player-state changes that cue a sound, in play order. Land gain is set separately. */
const PLAYER_RULES: readonly [soundId: string, fired: PlayerRule][] = [
  ["jump", (p, n) => n.jumpCount > p.jumpCount || n.wallJumpCount > p.wallJumpCount],
  ["land", (p, n) => n.landCount > p.landCount],
  ["tumble-bounce", (p, n) => n.tumbleBounceCount > p.tumbleBounceCount],
  ["dive-launch", (p, n) => n.divePhase === "travel" && p.divePhase !== "travel"],
  ["dive-impact", (p, n) => n.divePhase === "recovery" && n.diveBonked && p.divePhase === "travel"],
  ["respawn", (p, n) => n.inPlay && !p.inPlay],
  // A headbutt reset reuses the pickup sound, pitched by the collector (headbutt-reset D5).
  ["pickup", (p, n) => n.diveRefillCount > p.diveRefillCount],
];

function playerCues(
  previous: SoundPlayerSnapshot | undefined,
  now: SoundPlayerSnapshot
): SoundCue[] {
  if (!previous) return [];
  const cues = PLAYER_RULES.filter(([, fired]) => fired(previous, now)).map(([soundId]) =>
    cue(soundId, now.slot, soundId === "land" ? landingGain(now.lastLandingSpeed) : 1)
  );
  // Sinking into a crouch is a soft landing thud (no file of its own).
  if (now.crouchCount > previous.crouchCount)
    cues.push(cue("land", now.slot, SOUND_MIX.crouchGain));
  return cues;
}

function eventCues(events: readonly CombatEvent[], lastSeq: number): SoundCue[] {
  return events
    .filter((event) => event.seq > lastSeq)
    .map(combatEventCue)
    .filter((eventCue): eventCue is SoundCue => eventCue !== null);
}

/** Combat event → cue. Hits and eliminations take the victim's pitch, actions the actor's. */
function combatEventCue(event: CombatEvent): SoundCue | null {
  switch (event.type) {
    case "playerHit":
      return cue(event.source === "dive" ? "dive-impact" : "hit", event.victimSlot);
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
