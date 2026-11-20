import type { MusicTrackId } from "@/features/music/types/music.types";

/**
 * The music bank (DESIGN_LANGUAGE § 8): which file plays for each track and whether it loops.
 * Files live in `public/audio/music/` (post-processed: cut to whole bars, −16 LUFS mp3).
 */
export const MUSIC_BASE_URL = "/audio/music/";

export interface MusicTrack {
  url: string;
  /** Loops seamlessly (lobby, match); the final piece plays once and ends with the round. */
  loop: boolean;
}

export const MUSIC_TRACKS: Readonly<Record<MusicTrackId, MusicTrack>> = {
  lobby: { url: `${MUSIC_BASE_URL}lobby.mp3`, loop: true },
  match: { url: `${MUSIC_BASE_URL}match.mp3`, loop: true },
  final: { url: `${MUSIC_BASE_URL}final.mp3`, loop: false },
};

/** Seconds left in a round when the final piece takes over (owner feedback round 2 § 3). */
export const FINAL_MUSIC_SECONDS = 30;

/** Seconds a track change crossfades over. */
export const MUSIC_FADE_SECONDS = 0.8;

/** The round slice music reads. */
export interface MusicRoundSnapshot {
  phase: "playing" | "ended";
  remainingSeconds: number;
}

/** The track for a round: match loop, the final piece in the last 30 s, silence once ended. */
export function musicTrackFor(round: MusicRoundSnapshot): MusicTrackId | null {
  if (round.phase === "ended") return null;
  return round.remainingSeconds <= FINAL_MUSIC_SECONDS ? "final" : "match";
}
