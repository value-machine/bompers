/**
 * The sound bank: which files play for each content-catalog sound ID, and the mix rules from
 * DESIGN_LANGUAGE § 8 (per-player pitch, explosion ducking). Files live in
 * `public/audio/sfx/` (post-processed: trimmed, faded, −16 LUFS, mono mp3). A sound with
 * several takes plays a random one, never the same take twice in a row.
 * Spare takes kept for later (`dive-impact-spare-*`, `elimination-spare-*`) are not listed.
 */
export const SFX_BASE_URL = "/audio/sfx/";

const takes = (soundId: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${SFX_BASE_URL}${soundId}-${index + 1}.mp3`);

/** Sound ID → take URLs. Every key is a content-catalog sound ID (tested). */
export const SOUND_FILES: Readonly<Record<string, readonly string[]>> = {
  jump: takes("jump", 1),
  land: takes("land", 1),
  "tumble-bounce": takes("tumble-bounce", 1),
  "dive-launch": takes("dive-launch", 1),
  "dive-impact": takes("dive-impact", 1),
  hit: takes("hit", 1),
  elimination: takes("elimination", 1),
  "rocket-fire": takes("rocket-fire", 1),
  explosion: takes("explosion", 3),
  pickup: takes("pickup", 2),
  respawn: takes("respawn", 1),
  "round-start": takes("round-start", 4),
  "round-end": takes("round-end", 6),
};

/** Semitone offset per player slot (P1 0, P2 +2, P3 −2, P4 +4), so four blobs never sound alike. */
export const PLAYER_PITCH_SEMITONES: readonly number[] = [0, 2, -2, 4];

/** Playback rate for a slot's pitch offset (null slot = unpitched). */
export function playbackRateFor(slot: number | null): number {
  if (slot === null) return 1;
  const semitones = PLAYER_PITCH_SEMITONES[slot % PLAYER_PITCH_SEMITONES.length] ?? 0;
  return 2 ** (semitones / 12);
}

/** Mix settings (DESIGN_LANGUAGE § 8). Bus volumes come from the player's sound settings. */
export const SOUND_MIX = {
  masterGain: 0.8,
  /** Explosions duck the music bus by this much … */
  duckDecibels: 4,
  /** … for this long, then it recovers. */
  duckSeconds: 0.3,
  /** The same sound retriggering faster than this is dropped (a pile-up of landings). */
  minRetriggerSeconds: 0.04,
  /** Landing speed (units / s) that plays the land sound at full gain; slower is quieter. */
  fullLandingSpeed: 900,
  minLandingGain: 0.35,
  /** Sinking into a crouch replays the land sound this soft. */
  crouchGain: 0.3,
} as const;

/** Sounds that duck the music bus when they play. */
export const DUCKING_SOUNDS: ReadonlySet<string> = new Set(["explosion"]);

/** Takes a random take index for `count` takes, avoiding `previous` when there is a choice. */
export function pickTakeIndex(
  count: number,
  previous: number | null,
  random: () => number
): number {
  if (count <= 1) return 0;
  const pool = previous === null ? count : count - 1;
  const raw = Math.floor(random() * pool);
  return previous !== null && raw >= previous ? raw + 1 : raw;
}
