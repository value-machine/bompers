/**
 * Sound types. The sound feature reads the sim after each frame and turns what changed into
 * cues; it never writes to the sim. Sound IDs are content-catalog IDs (kind "sound").
 */

/** One sound to play now. */
export interface SoundCue {
  /** Content-catalog sound ID (`jump`, `explosion`, a material's sound …). */
  soundId: string;
  /** Player slot whose pitch offset applies, or null for unpitched (round, UI) sounds. */
  slot: number | null;
  /** 0–1 loudness for this cue (landings scale with fall speed). */
  gain: number;
}

/** One player's sound-relevant state for this frame (built by the match from its slices). */
export interface SoundPlayerSnapshot {
  slot: number;
  jumpCount: number;
  wallJumpCount: number;
  landCount: number;
  /** Downward speed at the last landing, units / s. */
  lastLandingSpeed: number;
  /** Roll terrain bounces, dash-roll starts and hit rolls that came to rest (monotonic). */
  rollBounceCount: number;
  dashRollCount: number;
  rollRestCount: number;
  /** Crouch starts (monotonic). */
  crouchCount: number;
  /** False while eliminated and waiting to respawn. */
  inPlay: boolean;
  /** Dive phase, and whether the current recovery is a head-on terrain bonk. */
  divePhase: "idle" | "windup" | "travel" | "recovery";
  diveBonked: boolean;
  /** Catalog sound of the material a head-on bonk hit (`"none"` when unknown or not bonked). */
  diveBonkSoundId: string;
  /** Body speed this frame, units / s (a hit victim's knockback: the hit's intensity). */
  speed: number;
  /** Speed into the terrain this step, fastest axis, units / s (0 when nothing was hit). */
  terrainHitSpeed: number;
  /** Headbutt resets taken over the match (monotonic). */
  diveRefillCount: number;
  /** Times caught fire / put out by ice over the match (monotonic; fire-burn D7). */
  catchFireCount: number;
  iceDouseCount: number;
}

/**
 * The world's element state for this frame (fire and ice), built by the match. Counts are
 * monotonic where noted, so the reader can see what changed since the last frame.
 */
export interface SoundWorldSnapshot {
  /** Sim time, seconds (rate limits for the thaw and steam cues). */
  timeSeconds: number;
  /** Slots spraying a torch / a freeze ray this step. */
  torchSlots: readonly number[];
  freezeSlots: readonly number[];
  /** Terrain samples burning now, and blobs on fire now. */
  burningSamples: number;
  burningBlobs: number;
  /** Frozen samples that have thawed by themselves over the match (monotonic). */
  thawedSamples: number;
  /** The terrain's frozen-flag version (changes whenever a sample freezes or thaws). */
  frozenVersion: number;
}

/**
 * A held sound: plays on a loop while the frame lists it, at its gain, and fades out when it is
 * gone (`key` tells loops of the same sound apart, e.g. one torch per player).
 */
export interface SoundLoop {
  key: string;
  soundId: string;
  /** Player slot whose pitch applies, or null for world loops. */
  slot: number | null;
  gain: number;
}

/** The two volume channels: sound effects and music. */
export type SoundChannel = "sfx" | "music";

/**
 * The player's audio settings (remembered by the browser). Volumes are 0–1 in tenths; the
 * enabled flags are on/off switches kept apart from the volume (a pause menu can toggle them
 * without losing the level). The M key is a separate master mute.
 */
export interface SoundSettings {
  sfxVolume: number;
  musicVolume: number;
  sfxEnabled: boolean;
  musicEnabled: boolean;
}

/** Music tracks: the lobby loop, the match loop, and the piece for the last 30 s of a round. */
export type MusicTrackId = "lobby" | "match" | "final";
