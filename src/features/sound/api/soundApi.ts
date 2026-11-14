/** Public seam of the sound feature: frame → cues, and the Web Audio player that plays them. */
export type { SoundCue, SoundPlayerSnapshot } from "@/features/sound/types/sound.types";
export {
  readSoundCues,
  type SoundCursor,
  type SoundSnapshot,
} from "@/features/sound/services/soundCues";
export {
  createSoundPlayer,
  MUTE_KEY_CODE,
  type SoundHost,
  type SoundPlayer,
} from "@/features/sound/services/soundPlayer";
export { PLAYER_PITCH_SEMITONES, SOUND_FILES } from "@/features/sound/services/soundBank";
