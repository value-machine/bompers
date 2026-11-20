/** Public seam of the music feature: the tracks, which one a round wants, and the player. */
export type { MusicTrackId } from "@/features/music/types/music.types";
export {
  FINAL_MUSIC_SECONDS,
  MUSIC_TRACKS,
  musicTrackFor,
  type MusicRoundSnapshot,
} from "@/features/music/services/musicBank";
export { createMusicPlayer, type MusicPlayer } from "@/features/music/services/musicPlayer";
