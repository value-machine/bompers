/** Public seam of the sound feature: frame → cues, the app's audio engine, music and settings. */
export type {
  SoundBurst,
  SoundChannel,
  SoundCue,
  SoundLoop,
  SoundPlayerSnapshot,
  SoundSettings,
  SoundStatus,
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
export {
  VOLUME_STEPS,
  isChannelEnabled,
  withChannelEnabled,
  withVolumeStep,
} from "@/features/sound/services/soundSettings";
export {
  useAudioEngine,
  useMusicTrack,
  useSoundStatus,
  useSoundSettings,
} from "@/features/sound/hooks/useAudioEngine";
export { SoundStatusChip } from "@/features/sound/components/SoundStatusChip";
export { SoundStatusCorner } from "@/features/sound/components/SoundStatusCorner";
export { PLAYER_PITCH_SEMITONES, SOUND_FILES } from "@/features/sound/services/soundBank";
