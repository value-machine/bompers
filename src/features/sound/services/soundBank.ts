/**
 * The sound bank: which files play for each content-catalog sound ID, and the mix rules from
 * DESIGN_LANGUAGE § 8 (per-player pitch, explosion ducking). Files live in
 * `public/audio/sfx/` (post-processed: trimmed, faded, −16 LUFS, mono mp3). A sound with
 * several takes plays a random one, never the same take twice in a row.
 * Spare takes kept for later (`dive-impact-spare-*`, `elimination-spare-*`) are not listed.
 * Material sounds (`thud`, `crumble`, `thwap`, `clink`) play when terrain is blasted and, layered,
 * when a dive bonks into it (material-sounds D1, D2).
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
  // Material sounds (owner picks, material-sounds lap).
  thud: takes("thud", 1),
  crumble: takes("crumble", 2),
  thwap: takes("thwap", 1),
  clink: takes("clink", 2),
  // Fire and ice (owner picks, element-sounds lap). `*-loop` and `fire-crackle` are loops.
  "torch-start": takes("torch-start", 1),
  "torch-loop": takes("torch-loop", 1),
  "fire-crackle": takes("fire-crackle", 1),
  "burn-out": takes("burn-out", 1),
  "catch-fire": takes("catch-fire", 1),
  "steam-hiss": takes("steam-hiss", 1),
  "freeze-start": takes("freeze-start", 1),
  "freeze-loop": takes("freeze-loop", 1),
  thaw: takes("thaw", 1),
  // The frozen blob's ice block (owner picks, ice-block-sounds lap).
  "freeze-solid": takes("freeze-solid", 1),
  "ice-crack": takes("ice-crack", 1),
  "ice-shatter": takes("ice-shatter", 1),
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
  /**
   * One blob's own sound (its landing, bounce, jump …) replaying sooner than this, in sim
   * seconds, is dropped (collision-sound-jitter): longer than any contact jitter, shorter than
   * the quickest real repeat (a jump and its landing are 0.3 s and more apart).
   */
  bodyRetriggerSeconds: 0.15,
  /**
   * Touchdowns slower than this (units / s) play no landing sound: a fall of under a third of the
   * body height. The softest real landing, a cut-short hop, lands at about 380.
   */
  landingMinSpeed: 150,
  /**
   * The two intensity knobs (owner, 2026-11-16): the impact speed (units / s) that plays at full
   * volume; slower is quieter, down to `JUICE_VOLUME.minGain` (`intensityGain`, gameJuice.ts).
   * Landing: fall speed at touchdown. Hit: a wall bonk's speed into the wall, or a hit victim's
   * knockback speed (a full dive hit is about 1000, a point-blank blast hit about 220).
   */
  landingFullSpeed: 900,
  hitFullSpeed: 1000,
  /** Sinking into a crouch replays the land sound this soft. */
  crouchGain: 0.3,
  /**
   * Fire and ice (element-sounds lap). The fire crackle is at full volume with this many burning
   * samples (a blob on fire counts as `fireBlobSamples`); a thaw cue at full volume with this
   * many samples thawed since the last one; thaw and steam cues play at most this often.
   */
  fireFullSamples: 400,
  fireBlobSamples: 60,
  thawFullSamples: 60,
  elementCueSeconds: 0.5,
  /** Held loops fade in and out over this long; a loop not refreshed for `loopHoldSeconds` fades. */
  loopFadeSeconds: 0.12,
  loopHoldSeconds: 0.25,
  /**
   * A held loop plays its file as passes that overlap this long with an equal-power crossfade
   * (on top of the crossfade baked into the file), which also hides the mp3's silent edges.
   */
  loopCrossfadeSeconds: 0.1,
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
