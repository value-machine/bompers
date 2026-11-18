/** Public seam of the sound feature: frame → cues, the app's audio engine, music and settings. */
export type {
  MusicTrackId,
  SoundChannel,
  SoundCue,
  SoundLoop,
  SoundPlayerSnapshot,
  SoundSettings,
  SoundWorldSnapshot,
} from "@/features/sound/types/sound.types";
export {
  readSoundCues,
  readSoundLoops,
  type SoundCursor,
  type SoundSnapshot,
} from "@/features/sound/services/soundCues";
export {
  MUTE_KEY_CODE,
  type AudioEngine,
  type SoundHost,
} from "@/features/sound/services/audioEngine";
export { musicTrackFor, FINAL_MUSIC_SECONDS } from "@/features/sound/services/musicBank";
export {
  VOLUME_STEPS,
  isChannelEnabled,
  withChannelEnabled,
  withVolumeStep,
} from "@/features/sound/services/soundSettings";
export {
  useAudioEngine,
  useMusicTrack,
  useSoundSettings,
} from "@/features/sound/hooks/useAudioEngine";
export { PLAYER_PITCH_SEMITONES, SOUND_FILES } from "@/features/sound/services/soundBank";
