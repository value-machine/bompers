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
  tumbleBounceCount: number;
  /** Crouch starts (monotonic). */
  crouchCount: number;
  /** False while eliminated and waiting to respawn. */
  inPlay: boolean;
  /** Dive phase, and whether the current recovery is a head-on terrain bonk. */
  divePhase: "idle" | "windup" | "travel" | "recovery";
  diveBonked: boolean;
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
